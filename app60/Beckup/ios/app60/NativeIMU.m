#import "NativeIMU.h"
#import <React/RCTLog.h>
#import <CoreMotion/CoreMotion.h>
#import <QuartzCore/QuartzCore.h>
#import <float.h>
#import <math.h>

static const double kDefaultHz = 60.0;
static const double kMinHz = 20.0;
static const double kMaxHz = 200.0;

static const NSInteger kBaselineTargetCount = 90;
static const NSInteger kBaselineWarmupCount = 15;

@interface NativeIMU ()

@property (nonatomic, strong) CMMotionManager *motionManager;
@property (nonatomic, strong) NSOperationQueue *queue;

@property (nonatomic, strong) NSMutableArray<NSArray<NSNumber *> *> *samples;
@property (nonatomic, strong) NSMutableArray<NSNumber *> *acceptedDtMs;

@property (nonatomic, assign) BOOL running;
@property (nonatomic, assign) BOOL hasListeners;

@property (nonatomic, assign) double targetHz;
@property (nonatomic, assign) double targetDtMs;

@property (nonatomic, assign) double startWallMs;

/**
 Base temporal dos sensores (CoreMotion timestamp => segundos desde boot).
 Trabalhamos em ms.
 */
@property (nonatomic, assign) double firstAcceptedSensorMs;
@property (nonatomic, assign) BOOL hasFirstAcceptedSample;

/** Token para invalidar callbacks antigos após restart */
@property (nonatomic, assign) NSUInteger sessionToken;

/** Últimos valores conhecidos */
@property (nonatomic, assign) double lastAx;
@property (nonatomic, assign) double lastAy;
@property (nonatomic, assign) double lastAz;

@property (nonatomic, assign) double lastUserAx;
@property (nonatomic, assign) double lastUserAy;
@property (nonatomic, assign) double lastUserAz;

@property (nonatomic, assign) double lastGravX;
@property (nonatomic, assign) double lastGravY;
@property (nonatomic, assign) double lastGravZ;

@property (nonatomic, assign) double lastRoll;
@property (nonatomic, assign) double lastPitch;
@property (nonatomic, assign) double lastYaw;

/** Timestamps absolutos de sensor (ms na base do CoreMotion) */
@property (nonatomic, assign) double lastAccSensorMs;
@property (nonatomic, assign) double lastGyroSensorMs;
@property (nonatomic, assign) double lastUserAccSensorMs;
@property (nonatomic, assign) double lastGravSensorMs;
@property (nonatomic, assign) double lastAttSensorMs;

@property (nonatomic, strong, nullable) NSNumber *lastAcceptedTms;

/** Flags de disponibilidade / prontidão */
@property (nonatomic, assign) BOOL deviceMotionActive;
@property (nonatomic, assign) BOOL hasAccelSample;
@property (nonatomic, assign) BOOL hasUserAccSample;
@property (nonatomic, assign) BOOL hasGravSample;
@property (nonatomic, assign) BOOL hasAttSample;

/** Métricas de frescor */
@property (nonatomic, assign) double accAgeSumMs;
@property (nonatomic, assign) double accAgeMaxMs;
@property (nonatomic, assign) NSInteger accAgeCount;

@property (nonatomic, assign) double userAccAgeSumMs;
@property (nonatomic, assign) double userAccAgeMaxMs;
@property (nonatomic, assign) NSInteger userAccAgeCount;

@property (nonatomic, assign) double gravAgeSumMs;
@property (nonatomic, assign) double gravAgeMaxMs;
@property (nonatomic, assign) NSInteger gravAgeCount;

@property (nonatomic, assign) double attAgeSumMs;
@property (nonatomic, assign) double attAgeMaxMs;
@property (nonatomic, assign) NSInteger attAgeCount;

/** Modo */
@property (nonatomic, copy) NSString *mode;

/** Estado do TUG */
@property (nonatomic, assign) BOOL tugHasBaseline;
@property (nonatomic, assign) BOOL tugHasLeftBaseline;
@property (nonatomic, assign) double tugStartDetectedMs;
@property (nonatomic, assign) double tugEndDetectedMs;
@property (nonatomic, assign) double tugFinishStillnessBeganMs;

@property (nonatomic, assign) double baselinePitch;
@property (nonatomic, assign) double baselineRoll;
@property (nonatomic, assign) double baselineYaw;
@property (nonatomic, assign) double baselineGravityNorm;
@property (nonatomic, assign) double baselineUserAccNorm;
@property (nonatomic, assign) double baselineGyroNorm;

@property (nonatomic, strong) NSMutableArray<NSArray<NSNumber *> *> *baselineRows;

@end

@implementation NativeIMU

RCT_EXPORT_MODULE(NativeIMU);

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (instancetype)init
{
  self = [super init];
  if (self) {
    _motionManager = [[CMMotionManager alloc] init];
    _queue = [[NSOperationQueue alloc] init];
    _queue.name = @"br.ufpr.app60.NativeIMUQueue";
    _queue.qualityOfService = NSQualityOfServiceUserInitiated;
    _queue.maxConcurrentOperationCount = 1;

    _samples = [NSMutableArray new];
    _acceptedDtMs = [NSMutableArray new];
    _baselineRows = [NSMutableArray new];

    _running = NO;
    _hasListeners = NO;
    _targetHz = kDefaultHz;
    _targetDtMs = 1000.0 / kDefaultHz;
    _mode = @"default";
    _sessionToken = 0;

    [self internalReset];
  }
  return self;
}

- (NSArray<NSString *> *)supportedEvents
{
  return @[ @"NativeIMUAutoStop" ];
}

- (void)startObserving
{
  self.hasListeners = YES;
}

- (void)stopObserving
{
  self.hasListeners = NO;
}

RCT_EXPORT_METHOD(start:(NSDictionary *)options)
{
  @synchronized (self) {
    if (self.running) {
      [self unregisterAll];
      [self internalReset];
    }

    double requestedHz = kDefaultHz;
    id hzValue = options[@"hz"];
    if ([hzValue isKindOfClass:[NSNumber class]]) {
      requestedHz = [hzValue doubleValue];
    }

    NSString *mode = @"default";
    id modeValue = options[@"mode"];
    if ([modeValue isKindOfClass:[NSString class]] && [((NSString *)modeValue) length] > 0) {
      mode = (NSString *)modeValue;
    }

    double safeHz = requestedHz;
    if (safeHz < kMinHz) safeHz = kMinHz;
    if (safeHz > kMaxHz) safeHz = kMaxHz;

    if (!self.motionManager.accelerometerAvailable || !self.motionManager.gyroAvailable) {
      RCTLogError(@"NativeIMU: acelerômetro ou giroscópio não disponível");
      return;
    }

    self.mode = mode;
    self.targetHz = safeHz;
    self.targetDtMs = 1000.0 / safeHz;

    [self internalReset];

    self.startWallMs = [self.class nowWallMs];
    self.running = YES;
    self.sessionToken += 1;

    NSTimeInterval interval = 1.0 / safeHz;
    self.motionManager.accelerometerUpdateInterval = interval;
    self.motionManager.gyroUpdateInterval = interval;
    self.motionManager.deviceMotionUpdateInterval = interval;
  }

  __weak typeof(self) weakSelf = self;
  NSUInteger localToken = self.sessionToken;

  [self.motionManager startAccelerometerUpdatesToQueue:self.queue
                                           withHandler:^(CMAccelerometerData * _Nullable data, NSError * _Nullable error) {
    __strong typeof(weakSelf) self = weakSelf;
    if (!self || !data || error) return;

    @synchronized (self) {
      if (!self.running || self.sessionToken != localToken) return;

      double sensorMs = [self.class coreMotionTimestampToMs:data.timestamp];
      self.lastAx = data.acceleration.x;
      self.lastAy = data.acceleration.y;
      self.lastAz = data.acceleration.z;
      self.lastAccSensorMs = sensorMs;
      self.hasAccelSample = YES;
    }
  }];

  [self.motionManager startGyroUpdatesToQueue:self.queue
                                  withHandler:^(CMGyroData * _Nullable data, NSError * _Nullable error) {
    __strong typeof(weakSelf) self = weakSelf;
    if (!self || !data || error) return;

    @synchronized (self) {
      if (!self.running || self.sessionToken != localToken) return;
      [self handleGyro:data];
    }
  }];

  if (self.motionManager.deviceMotionAvailable) {
    self.deviceMotionActive = YES;

    [self.motionManager startDeviceMotionUpdatesUsingReferenceFrame:CMAttitudeReferenceFrameXArbitraryZVertical
                                                            toQueue:self.queue
                                                        withHandler:^(CMDeviceMotion * _Nullable motion, NSError * _Nullable error) {
      __strong typeof(weakSelf) self = weakSelf;
      if (!self || !motion || error) return;

      @synchronized (self) {
        if (!self.running || self.sessionToken != localToken) return;

        double sensorMs = [self.class coreMotionTimestampToMs:motion.timestamp];

        self.lastUserAx = motion.userAcceleration.x;
        self.lastUserAy = motion.userAcceleration.y;
        self.lastUserAz = motion.userAcceleration.z;
        self.lastUserAccSensorMs = sensorMs;
        self.hasUserAccSample = YES;

        self.lastGravX = motion.gravity.x;
        self.lastGravY = motion.gravity.y;
        self.lastGravZ = motion.gravity.z;
        self.lastGravSensorMs = sensorMs;
        self.hasGravSample = YES;

        self.lastRoll = motion.attitude.roll;
        self.lastPitch = motion.attitude.pitch;
        self.lastYaw = motion.attitude.yaw;
        self.lastAttSensorMs = sensorMs;
        self.hasAttSample = YES;
      }
    }];
  } else {
    self.deviceMotionActive = NO;
  }
}

RCT_EXPORT_METHOD(stop:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  @synchronized (self) {
    self.running = NO;
    self.sessionToken += 1;
    [self unregisterAll];
    resolve([self buildResultWithStopReason:@"manual"]);
  }
}

RCT_EXPORT_METHOD(clear)
{
  @synchronized (self) {
    [self internalReset];
  }
}

- (void)handleGyro:(CMGyroData *)data
{
  double sensorMs = [self.class coreMotionTimestampToMs:data.timestamp];
  if (![self canAcceptRowAtGyroSensorMs:sensorMs]) {
    return;
  }

  if (!self.hasFirstAcceptedSample) {
    self.firstAcceptedSensorMs = sensorMs;
    self.hasFirstAcceptedSample = YES;
  }

  double tMs = [self relativeMsForSensorMs:sensorMs];

  if (self.lastAcceptedTms != nil) {
    double lastT = [self.lastAcceptedTms doubleValue];
    double dt = tMs - lastT;
    double minAllowed = self.targetDtMs * 0.70;
    if (dt < minAllowed) return;
    if (dt > 0.0) [self.acceptedDtMs addObject:@(dt)];
  }

  self.lastAcceptedTms = @(tMs);
  self.lastGyroSensorMs = sensorMs;

  double gx = data.rotationRate.x;
  double gy = data.rotationRate.y;
  double gz = data.rotationRate.z;
  // wall_t_ms: tempo de parede decorrido desde o início da coleta (ms), não misturar epoch com t_ms do sensor.
  double wallTms = [self.class nowWallMs] - self.startWallMs;

  double accTms = [self relativeMsForSensorMs:self.lastAccSensorMs];
  double userAccTms = self.hasUserAccSample ? [self relativeMsForSensorMs:self.lastUserAccSensorMs] : 0.0;
  double gravTms = self.hasGravSample ? [self relativeMsForSensorMs:self.lastGravSensorMs] : 0.0;
  double attTms = self.hasAttSample ? [self relativeMsForSensorMs:self.lastAttSensorMs] : 0.0;
  // gyro_t_ms: instante do giroscópio na mesma base relativa que row_t_ms (callback do gyro; coincide com tMs).
  double gyroTms = tMs;

  [self updateAgeStatsForGyroSensorMs:sensorMs];

  NSArray<NSNumber *> *row = @[
    @(wallTms),          // 0 wall_t_ms
    @(tMs),              // 1 row_t_ms

    @(accTms),           // 2 acc_t_ms
    @(self.lastAx),      // 3
    @(self.lastAy),      // 4
    @(self.lastAz),      // 5

    @(gyroTms),          // 6 gyro_t_ms
    @(gx),               // 7
    @(gy),               // 8
    @(gz),               // 9

    @(userAccTms),       // 10
    @(self.lastUserAx),  // 11
    @(self.lastUserAy),  // 12
    @(self.lastUserAz),  // 13

    @(gravTms),          // 14
    @(self.lastGravX),   // 15
    @(self.lastGravY),   // 16
    @(self.lastGravZ),   // 17

    @(attTms),           // 18
    @(self.lastRoll),    // 19
    @(self.lastPitch),   // 20
    @(self.lastYaw)      // 21
  ];

  [self.samples addObject:row];

  if ([self.mode isEqualToString:@"tug"]) {
    [self processTugRow:row relativeTms:tMs];
  }
}

- (BOOL)canAcceptRowAtGyroSensorMs:(double)gyroSensorMs
{
  if (!self.hasAccelSample) return NO;

  double maxAgeMs = MAX(35.0, self.targetDtMs * 2.5);
  double accAge = gyroSensorMs - self.lastAccSensorMs;
  if (accAge < 0.0 || accAge > maxAgeMs) return NO;

  if (self.deviceMotionActive) {
    if (!self.hasUserAccSample || !self.hasGravSample || !self.hasAttSample) return NO;

    double userAge = gyroSensorMs - self.lastUserAccSensorMs;
    double gravAge = gyroSensorMs - self.lastGravSensorMs;
    double attAge = gyroSensorMs - self.lastAttSensorMs;

    if (userAge < 0.0 || userAge > maxAgeMs) return NO;
    if (gravAge < 0.0 || gravAge > maxAgeMs) return NO;
    if (attAge < 0.0 || attAge > maxAgeMs) return NO;
  }

  return YES;
}

- (void)updateAgeStatsForGyroSensorMs:(double)gyroSensorMs
{
  double accAge = MAX(0.0, gyroSensorMs - self.lastAccSensorMs);
  self.accAgeSumMs += accAge;
  self.accAgeCount += 1;
  if (accAge > self.accAgeMaxMs) self.accAgeMaxMs = accAge;

  if (self.hasUserAccSample) {
    double age = MAX(0.0, gyroSensorMs - self.lastUserAccSensorMs);
    self.userAccAgeSumMs += age;
    self.userAccAgeCount += 1;
    if (age > self.userAccAgeMaxMs) self.userAccAgeMaxMs = age;
  }

  if (self.hasGravSample) {
    double age = MAX(0.0, gyroSensorMs - self.lastGravSensorMs);
    self.gravAgeSumMs += age;
    self.gravAgeCount += 1;
    if (age > self.gravAgeMaxMs) self.gravAgeMaxMs = age;
  }

  if (self.hasAttSample) {
    double age = MAX(0.0, gyroSensorMs - self.lastAttSensorMs);
    self.attAgeSumMs += age;
    self.attAgeCount += 1;
    if (age > self.attAgeMaxMs) self.attAgeMaxMs = age;
  }
}

- (double)relativeMsForSensorMs:(double)sensorMs
{
  if (!self.hasFirstAcceptedSample) return 0.0;
  double value = sensorMs - self.firstAcceptedSensorMs;
  return value > 0.0 ? value : 0.0;
}

- (void)processTugRow:(NSArray<NSNumber *> *)row relativeTms:(double)tMs
{
  double gx = [row[7] doubleValue];
  double gy = [row[8] doubleValue];
  double gz = [row[9] doubleValue];

  double userAx = [row[11] doubleValue];
  double userAy = [row[12] doubleValue];
  double userAz = [row[13] doubleValue];

  double gravX = [row[15] doubleValue];
  double gravY = [row[16] doubleValue];
  double gravZ = [row[17] doubleValue];

  double roll = [row[19] doubleValue];
  double pitch = [row[20] doubleValue];
  double yaw = [row[21] doubleValue];

  double gyroNorm = sqrt(gx*gx + gy*gy + gz*gz);
  double userAccNorm = sqrt(userAx*userAx + userAy*userAy + userAz*userAz);
  double gravNorm = sqrt(gravX*gravX + gravY*gravY + gravZ*gravZ);

  if (!self.tugHasBaseline) {
    [self updateBaselineWithRow:row
                       gyroNorm:gyroNorm
                    userAccNorm:userAccNorm
                       gravNorm:gravNorm
                           roll:roll
                          pitch:pitch
                            yaw:yaw];

    if (!self.tugHasBaseline) {
      return;
    }
  }

  double pitchRel = fabs([self.class angleDelta:pitch ref:self.baselinePitch]);
  double rollRel  = fabs([self.class angleDelta:roll ref:self.baselineRoll]);
  double yawRel   = fabs([self.class angleDelta:yaw ref:self.baselineYaw]);

  BOOL movedAway =
      (gyroNorm > MAX(1.2, self.baselineGyroNorm + 0.8)) ||
      (userAccNorm > MAX(0.18, self.baselineUserAccNorm + 0.12)) ||
      (pitchRel > 0.20) ||
      (rollRel > 0.20) ||
      (yawRel > 0.35);

  if (!self.tugHasLeftBaseline) {
    if (movedAway) {
      self.tugHasLeftBaseline = YES;
      self.tugStartDetectedMs = tMs;
    }
    return;
  }

  double elapsedSinceStart = tMs - self.tugStartDetectedMs;
  if (elapsedSinceStart < 2500.0) return;

  BOOL stableNow =
      (gyroNorm < MAX(0.60, self.baselineGyroNorm + 0.30)) &&
      (userAccNorm < MAX(0.12, self.baselineUserAccNorm + 0.07)) &&
      (pitchRel < 0.20) &&
      (rollRel < 0.20);

  if (stableNow) {
    if (self.tugFinishStillnessBeganMs <= 0.0) {
      self.tugFinishStillnessBeganMs = tMs;
    }
    if ((tMs - self.tugFinishStillnessBeganMs) >= 900.0) {
      self.tugEndDetectedMs = self.tugFinishStillnessBeganMs;
      [self autoStopWithReason:@"auto_finish"];
      return;
    }
  } else {
    self.tugFinishStillnessBeganMs = 0.0;
  }

  if (elapsedSinceStart >= 20000.0) {
    self.tugEndDetectedMs = tMs;
    [self autoStopWithReason:@"auto_timeout"];
    return;
  }
}

- (double)meanOf:(NSArray<NSNumber *> *)values
{
  if (values.count == 0) return 0.0;
  double sum = 0.0;
  for (NSNumber *n in values) sum += [n doubleValue];
  return sum / (double)values.count;
}

- (double)stdOf:(NSArray<NSNumber *> *)values
{
  if (values.count <= 1) return 0.0;
  double mean = [self meanOf:values];
  double acc = 0.0;
  for (NSNumber *n in values) {
    double d = [n doubleValue] - mean;
    acc += d * d;
  }
  return sqrt(acc / (double)values.count);
}

- (void)updateBaselineWithRow:(NSArray<NSNumber *> *)row
                     gyroNorm:(double)gyroNorm
                  userAccNorm:(double)userAccNorm
                     gravNorm:(double)gravNorm
                         roll:(double)roll
                        pitch:(double)pitch
                          yaw:(double)yaw
{
  if (self.baselineRows.count < kBaselineWarmupCount) {
    [self.baselineRows addObject:row];
    [self recomputeBaseline];
    if (self.baselineRows.count >= kBaselineTargetCount) {
      self.tugHasBaseline = YES;
    }
    return;
  }

  double pitchRel = fabs([self.class angleDelta:pitch ref:self.baselinePitch]);
  double rollRel  = fabs([self.class angleDelta:roll ref:self.baselineRoll]);
  double yawRel   = fabs([self.class angleDelta:yaw ref:self.baselineYaw]);

  BOOL stableForBaseline =
      (gyroNorm < MAX(0.60, self.baselineGyroNorm + 0.25)) &&
      (userAccNorm < MAX(0.10, self.baselineUserAccNorm + 0.06)) &&
      (fabs(gravNorm - self.baselineGravityNorm) < 0.10) &&
      (pitchRel < 0.10) &&
      (rollRel > -DBL_MAX && rollRel < 0.10) && // keep deterministic formatting
      (yawRel < 0.18);

  if (!stableForBaseline) {
    [self.baselineRows removeAllObjects];
    self.baselinePitch = 0.0;
    self.baselineRoll = 0.0;
    self.baselineYaw = 0.0;
    self.baselineGravityNorm = 1.0;
    self.baselineUserAccNorm = 0.0;
    self.baselineGyroNorm = 0.0;
    return;
  }

  [self.baselineRows addObject:row];
  [self recomputeBaseline];

  if (self.baselineRows.count >= kBaselineTargetCount) {
    self.tugHasBaseline = YES;
  }
}

- (void)recomputeBaseline
{
  if (self.baselineRows.count == 0) return;

  double sumPitch = 0.0, sumRoll = 0.0, sumYaw = 0.0;
  double sumGyro = 0.0, sumUser = 0.0, sumGrav = 0.0;

  for (NSArray<NSNumber *> *row in self.baselineRows) {
    double gx = [row[7] doubleValue];
    double gy = [row[8] doubleValue];
    double gz = [row[9] doubleValue];
    double userAx = [row[11] doubleValue];
    double userAy = [row[12] doubleValue];
    double userAz = [row[13] doubleValue];
    double gravX = [row[15] doubleValue];
    double gravY = [row[16] doubleValue];
    double gravZ = [row[17] doubleValue];
    double roll = [row[19] doubleValue];
    double pitch = [row[20] doubleValue];
    double yaw = [row[21] doubleValue];

    sumPitch += pitch;
    sumRoll += roll;
    sumYaw += yaw;
    sumGyro += sqrt(gx*gx + gy*gy + gz*gz);
    sumUser += sqrt(userAx*userAx + userAy*userAy + userAz*userAz);
    sumGrav += sqrt(gravX*gravX + gravY*gravY + gravZ*gravZ);
  }

  double n = (double)self.baselineRows.count;
  self.baselinePitch = sumPitch / n;
  self.baselineRoll = sumRoll / n;
  self.baselineYaw = sumYaw / n;
  self.baselineGyroNorm = sumGyro / n;
  self.baselineUserAccNorm = sumUser / n;
  self.baselineGravityNorm = sumGrav / n;
}

- (void)autoStopWithReason:(NSString *)reason
{
  if (!self.running) return;

  self.running = NO;
  self.sessionToken += 1;
  [self unregisterAll];

  NSDictionary *payload = [self buildResultWithStopReason:reason];
  if (self.hasListeners) {
    [self sendEventWithName:@"NativeIMUAutoStop" body:payload];
  }
}

- (NSDictionary *)buildResultWithStopReason:(NSString *)reason
{
  NSMutableDictionary *result = [NSMutableDictionary dictionary];
  result[@"samples"] = self.samples ?: @[];
  result[@"stats"] = [self buildStats] ?: @{};

  if ([self.mode isEqualToString:@"tug"]) {
    BOOL detected = self.tugHasLeftBaseline && self.tugEndDetectedMs > self.tugStartDetectedMs;
    result[@"tug"] = @{
      @"detected": @(detected),
      @"startDetectedMs": @(self.tugStartDetectedMs > 0.0 ? self.tugStartDetectedMs : 0.0),
      @"endDetectedMs": @(self.tugEndDetectedMs > 0.0 ? self.tugEndDetectedMs : 0.0),
      @"durationMs": @(detected ? (self.tugEndDetectedMs - self.tugStartDetectedMs) : 0.0),
      @"stopReason": reason ?: @"manual"
    };
  }

  return result;
}

- (void)unregisterAll
{
  [self.motionManager stopAccelerometerUpdates];
  [self.motionManager stopGyroUpdates];
  [self.motionManager stopDeviceMotionUpdates];
}

- (void)internalReset
{
  [self.samples removeAllObjects];
  [self.acceptedDtMs removeAllObjects];
  [self.baselineRows removeAllObjects];

  self.lastAx = 0.0; self.lastAy = 0.0; self.lastAz = 0.0;
  self.lastUserAx = 0.0; self.lastUserAy = 0.0; self.lastUserAz = 0.0;
  self.lastGravX = 0.0; self.lastGravY = 0.0; self.lastGravZ = 0.0;
  self.lastRoll = 0.0; self.lastPitch = 0.0; self.lastYaw = 0.0;

  self.lastAccSensorMs = 0.0;
  self.lastGyroSensorMs = 0.0;
  self.lastUserAccSensorMs = 0.0;
  self.lastGravSensorMs = 0.0;
  self.lastAttSensorMs = 0.0;

  self.lastAcceptedTms = nil;

  self.startWallMs = 0.0;
  self.firstAcceptedSensorMs = 0.0;
  self.hasFirstAcceptedSample = NO;

  self.deviceMotionActive = NO;
  self.hasAccelSample = NO;
  self.hasUserAccSample = NO;
  self.hasGravSample = NO;
  self.hasAttSample = NO;

  self.accAgeSumMs = 0.0;
  self.accAgeMaxMs = 0.0;
  self.accAgeCount = 0;

  self.userAccAgeSumMs = 0.0;
  self.userAccAgeMaxMs = 0.0;
  self.userAccAgeCount = 0;

  self.gravAgeSumMs = 0.0;
  self.gravAgeMaxMs = 0.0;
  self.gravAgeCount = 0;

  self.attAgeSumMs = 0.0;
  self.attAgeMaxMs = 0.0;
  self.attAgeCount = 0;

  self.tugHasBaseline = NO;
  self.tugHasLeftBaseline = NO;
  self.tugStartDetectedMs = 0.0;
  self.tugEndDetectedMs = 0.0;
  self.tugFinishStillnessBeganMs = 0.0;

  self.baselinePitch = 0.0;
  self.baselineRoll = 0.0;
  self.baselineYaw = 0.0;
  self.baselineGravityNorm = 1.0;
  self.baselineUserAccNorm = 0.0;
  self.baselineGyroNorm = 0.0;
}

- (NSDictionary *)buildStats
{
  NSInteger n = self.samples.count;

  double accAgeMean = self.accAgeCount > 0 ? self.accAgeSumMs / (double)self.accAgeCount : 0.0;
  double userAccAgeMean = self.userAccAgeCount > 0 ? self.userAccAgeSumMs / (double)self.userAccAgeCount : 0.0;
  double gravAgeMean = self.gravAgeCount > 0 ? self.gravAgeSumMs / (double)self.gravAgeCount : 0.0;
  double attAgeMean = self.attAgeCount > 0 ? self.attAgeSumMs / (double)self.attAgeCount : 0.0;

  if (self.acceptedDtMs.count == 0) {
    return @{
      @"n": @(n),
      @"hzMean": @(0.0),
      @"dtMeanMs": @(0.0),
      @"dtMinMs": @(0.0),
      @"dtMaxMs": @(0.0),
      @"pctIn58to62": @(0.0),
      @"droppedEstimated": @(0),
      @"targetHz": @(self.targetHz),
      @"targetDtMs": @(self.targetDtMs),
      @"dtCount": @(0),
      @"accAgeMeanMs": @(accAgeMean),
      @"accAgeMaxMs": @(self.accAgeMaxMs),
      @"userAccAgeMeanMs": @(userAccAgeMean),
      @"userAccAgeMaxMs": @(self.userAccAgeMaxMs),
      @"gravAgeMeanMs": @(gravAgeMean),
      @"gravAgeMaxMs": @(self.gravAgeMaxMs),
      @"attAgeMeanMs": @(attAgeMean),
      @"attAgeMaxMs": @(self.attAgeMaxMs),
      @"deviceMotionActive": @(self.deviceMotionActive)
    };
  }

  double sum = 0.0;
  double minDt = DBL_MAX;
  double maxDt = -DBL_MAX;
  NSInteger in58to62 = 0;
  NSInteger droppedEstimated = 0;

  for (NSNumber *num in self.acceptedDtMs) {
    double dt = [num doubleValue];
    sum += dt;
    if (dt < minDt) minDt = dt;
    if (dt > maxDt) maxDt = dt;

    double hz = dt > 0.0 ? 1000.0 / dt : 0.0;
    if (hz >= 58.0 && hz <= 62.0) in58to62 += 1;

    double expectedSlots = dt / self.targetDtMs;
    if (expectedSlots > 1.5) {
      NSInteger extra = MAX(0, (NSInteger)llround(expectedSlots) - 1);
      droppedEstimated += extra;
    }
  }

  double dtMean = sum / (double)self.acceptedDtMs.count;
  double hzMean = dtMean > 0.0 ? 1000.0 / dtMean : 0.0;
  double pctIn58to62 = ((double)in58to62 / (double)self.acceptedDtMs.count) * 100.0;

  return @{
    @"n": @(n),
    @"hzMean": @(hzMean),
    @"dtMeanMs": @(dtMean),
    @"dtMinMs": @(minDt),
    @"dtMaxMs": @(maxDt),
    @"pctIn58to62": @(pctIn58to62),
    @"droppedEstimated": @(droppedEstimated),
    @"targetHz": @(self.targetHz),
    @"targetDtMs": @(self.targetDtMs),
    @"dtCount": @(self.acceptedDtMs.count),
    @"accAgeMeanMs": @(accAgeMean),
    @"accAgeMaxMs": @(self.accAgeMaxMs),
    @"userAccAgeMeanMs": @(userAccAgeMean),
    @"userAccAgeMaxMs": @(self.userAccAgeMaxMs),
    @"gravAgeMeanMs": @(gravAgeMean),
    @"gravAgeMaxMs": @(self.gravAgeMaxMs),
    @"attAgeMeanMs": @(attAgeMean),
    @"attAgeMaxMs": @(self.attAgeMaxMs),
    @"deviceMotionActive": @(self.deviceMotionActive)
  };
}

+ (double)angleDelta:(double)value ref:(double)ref
{
  double d = value - ref;
  while (d > M_PI) d -= 2.0 * M_PI;
  while (d < -M_PI) d += 2.0 * M_PI;
  return d;
}

+ (double)coreMotionTimestampToMs:(NSTimeInterval)timestamp
{
  return timestamp * 1000.0;
}

+ (double)nowWallMs
{
  return [[NSDate date] timeIntervalSince1970] * 1000.0;
}

@end

