package br.ufpr.app60

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.roundToInt
import kotlin.math.sqrt

class NativeIMU(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext), SensorEventListener {

  companion object {
    private const val DEFAULT_HZ = 60.0
    private const val MIN_HZ = 20.0
    private const val MAX_HZ = 200.0

    private const val BASELINE_TARGET_COUNT = 90
    private const val BASELINE_WARMUP_COUNT = 15
  }

  private val sensorManager =
    reactContext.getSystemService(Context.SENSOR_SERVICE) as SensorManager

  private val accelerometer: Sensor? =
    sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)

  private val gyroscope: Sensor? =
    sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE)

  private val gravitySensor: Sensor? =
    sensorManager.getDefaultSensor(Sensor.TYPE_GRAVITY)

  private val linearAccelerationSensor: Sensor? =
    sensorManager.getDefaultSensor(Sensor.TYPE_LINEAR_ACCELERATION)

  private val rotationVectorSensor: Sensor? =
    sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)

  /**
   * Cada amostra:
   * [
   *   wall_t_ms, row_t_ms,
   *   acc_t_ms, ax, ay, az,
   *   gyro_t_ms, gx, gy, gz,
   *   user_acc_t_ms, userAx, userAy, userAz,
   *   grav_t_ms, gravX, gravY, gravZ,
   *   att_t_ms, roll, pitch, yaw
   * ]
   */
  private val samples = CopyOnWriteArrayList<DoubleArray>()
  private val acceptedDtMs = CopyOnWriteArrayList<Double>()

  @Volatile private var running = false
  @Volatile private var targetHz = DEFAULT_HZ
  @Volatile private var targetDtMs = 1000.0 / DEFAULT_HZ
  @Volatile private var mode: String = "default"

  /** Base do relógio da sessão */
  @Volatile private var startWallMs: Long = 0L
  @Volatile private var firstAcceptedSensorNs: Long = 0L
  @Volatile private var hasFirstAcceptedSample = false

  /** Token de sessão para invalidar callback atrasado */
  @Volatile private var sessionId: Long = 0L

  /** Últimos valores conhecidos */
  @Volatile private var lastAx = 0.0
  @Volatile private var lastAy = 0.0
  @Volatile private var lastAz = 0.0

  @Volatile private var lastUserAx = 0.0
  @Volatile private var lastUserAy = 0.0
  @Volatile private var lastUserAz = 0.0

  @Volatile private var lastGravX = 0.0
  @Volatile private var lastGravY = 0.0
  @Volatile private var lastGravZ = 0.0

  @Volatile private var lastRoll = 0.0
  @Volatile private var lastPitch = 0.0
  @Volatile private var lastYaw = 0.0

  /** Timestamps absolutos do sensor em ns */
  @Volatile private var lastAccSensorNs = 0L
  @Volatile private var lastGyroSensorNs = 0L
  @Volatile private var lastUserAccSensorNs = 0L
  @Volatile private var lastGravSensorNs = 0L
  @Volatile private var lastAttSensorNs = 0L

  @Volatile private var hasAccelSample = false
  @Volatile private var hasUserAccSample = false
  @Volatile private var hasGravSample = false
  @Volatile private var hasAttSample = false

  @Volatile private var lastAcceptedTms = Double.NaN

  /** Métricas de frescor */
  @Volatile private var accAgeSumMs = 0.0
  @Volatile private var accAgeMaxMs = 0.0
  @Volatile private var accAgeCount = 0

  @Volatile private var userAccAgeSumMs = 0.0
  @Volatile private var userAccAgeMaxMs = 0.0
  @Volatile private var userAccAgeCount = 0

  @Volatile private var gravAgeSumMs = 0.0
  @Volatile private var gravAgeMaxMs = 0.0
  @Volatile private var gravAgeCount = 0

  @Volatile private var attAgeSumMs = 0.0
  @Volatile private var attAgeMaxMs = 0.0
  @Volatile private var attAgeCount = 0

  /** Estado do TUG */
  @Volatile private var tugHasBaseline = false
  @Volatile private var tugHasLeftBaseline = false
  @Volatile private var tugStartDetectedMs = 0.0
  @Volatile private var tugEndDetectedMs = 0.0
  @Volatile private var tugFinishStillnessBeganMs = 0.0

  @Volatile private var baselinePitch = 0.0
  @Volatile private var baselineRoll = 0.0
  @Volatile private var baselineYaw = 0.0
  @Volatile private var baselineGravityNorm = 1.0
  @Volatile private var baselineUserAccNorm = 0.0
  @Volatile private var baselineGyroNorm = 0.0

  private val baselineRows = CopyOnWriteArrayList<DoubleArray>()

  override fun getName(): String = "NativeIMU"

  @ReactMethod
  fun start(options: ReadableMap) {
    synchronized(this) {
      try {
        if (running) {
          unregisterAll()
          internalReset()
        }

        val requestedHz = if (options.hasKey("hz")) options.getDouble("hz") else DEFAULT_HZ
        val safeHz = requestedHz.coerceIn(MIN_HZ, MAX_HZ)
        val requestedMode =
          if (options.hasKey("mode")) options.getString("mode") ?: "default" else "default"

        if (accelerometer == null || gyroscope == null) {
          throw RuntimeException("Acelerômetro ou giroscópio não disponível neste aparelho.")
        }

        targetHz = safeHz
        targetDtMs = 1000.0 / safeHz
        mode = requestedMode

        internalReset()
        startWallMs = System.currentTimeMillis()
        running = true
        sessionId += 1L

        val delayUs = (1_000_000.0 / safeHz).roundToInt().coerceAtLeast(1_000)

        sensorManager.registerListener(this, accelerometer, delayUs)
        sensorManager.registerListener(this, gyroscope, delayUs)
        gravitySensor?.let { sensorManager.registerListener(this, it, delayUs) }
        linearAccelerationSensor?.let { sensorManager.registerListener(this, it, delayUs) }
        rotationVectorSensor?.let { sensorManager.registerListener(this, it, delayUs) }
      } catch (e: Exception) {
        running = false
        unregisterAll()
        throw RuntimeException("Falha ao iniciar NativeIMU: ${e.message}", e)
      }
    }
  }

  @ReactMethod
  fun stop(promise: Promise) {
    synchronized(this) {
      try {
        running = false
        sessionId += 1L
        unregisterAll()
        promise.resolve(buildResultMap("manual"))
      } catch (e: Exception) {
        promise.reject("NATIVE_IMU_STOP_ERROR", e.message, e)
      }
    }
  }

  @ReactMethod
  fun clear() {
    synchronized(this) {
      internalReset()
    }
  }

  @ReactMethod
  fun addListener(eventName: String) {
    // requerido pelo NativeEventEmitter
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // requerido pelo NativeEventEmitter
  }

  override fun onSensorChanged(event: SensorEvent) {
    synchronized(this) {
      if (!running) return

      when (event.sensor.type) {
        Sensor.TYPE_ACCELEROMETER -> handleAccelerometer(event)
        Sensor.TYPE_LINEAR_ACCELERATION -> handleLinearAcceleration(event)
        Sensor.TYPE_GRAVITY -> handleGravity(event)
        Sensor.TYPE_ROTATION_VECTOR -> handleRotationVector(event)
        Sensor.TYPE_GYROSCOPE -> handleGyroscope(event)
      }
    }
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
    // sem ação
  }

  private fun handleAccelerometer(event: SensorEvent) {
    lastAx = event.values[0].toDouble()
    lastAy = event.values[1].toDouble()
    lastAz = event.values[2].toDouble()
    lastAccSensorNs = event.timestamp
    hasAccelSample = true
  }

  private fun handleLinearAcceleration(event: SensorEvent) {
    lastUserAx = event.values[0].toDouble()
    lastUserAy = event.values[1].toDouble()
    lastUserAz = event.values[2].toDouble()
    lastUserAccSensorNs = event.timestamp
    hasUserAccSample = true
  }

  private fun handleGravity(event: SensorEvent) {
    lastGravX = event.values[0].toDouble()
    lastGravY = event.values[1].toDouble()
    lastGravZ = event.values[2].toDouble()
    lastGravSensorNs = event.timestamp
    hasGravSample = true
  }

  private fun handleRotationVector(event: SensorEvent) {
    try {
      val rotationMatrix = FloatArray(9)
      SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values)

      val orientation = FloatArray(3)
      SensorManager.getOrientation(rotationMatrix, orientation)

      /**
       * orientation:
       * [0] yaw
       * [1] pitch
       * [2] roll
       */
      lastYaw = orientation[0].toDouble()
      lastPitch = orientation[1].toDouble()
      lastRoll = orientation[2].toDouble()
      lastAttSensorNs = event.timestamp
      hasAttSample = true
    } catch (_: Exception) {
      // segue o baile
    }
  }

  private fun handleGyroscope(event: SensorEvent) {
    val gyroSensorNs = event.timestamp

    if (!canAcceptRowAtGyroSensorNs(gyroSensorNs)) {
      return
    }

    if (!hasFirstAcceptedSample) {
      firstAcceptedSensorNs = gyroSensorNs
      hasFirstAcceptedSample = true
    }

    val tMs = relativeMsFromSensorNs(gyroSensorNs)

    if (!lastAcceptedTms.isNaN()) {
      val dt = tMs - lastAcceptedTms
      val minAllowed = targetDtMs * 0.70
      if (dt < minAllowed) return
      if (dt > 0.0) acceptedDtMs.add(dt)
    }

    val gx = event.values[0].toDouble()
    val gy = event.values[1].toDouble()
    val gz = event.values[2].toDouble()

    lastAcceptedTms = tMs
    lastGyroSensorNs = gyroSensorNs

    // wall_t_ms: tempo de parede decorrido desde o início da coleta (ms); não somar epoch com t_ms do sensor.
    val wallTms = (System.currentTimeMillis() - startWallMs).toDouble()

    val accTms = relativeMsFromSensorNs(lastAccSensorNs)
    val userAccTms = if (hasUserAccSample) relativeMsFromSensorNs(lastUserAccSensorNs) else 0.0
    val gravTms = if (hasGravSample) relativeMsFromSensorNs(lastGravSensorNs) else 0.0
    val attTms = if (hasAttSample) relativeMsFromSensorNs(lastAttSensorNs) else 0.0
    // gyro_t_ms: instante do giroscópio na base relativa (mesma linha que row_t_ms neste handler).
    val gyroTms = tMs

    updateAgeStatsForGyroSensorNs(gyroSensorNs)

    val row = doubleArrayOf(
      wallTms,            // 0 wall_t_ms
      tMs,                // 1 row_t_ms

      accTms,             // 2 acc_t_ms
      lastAx,             // 3
      lastAy,             // 4
      lastAz,             // 5

      gyroTms,           // 6 gyro_t_ms
      gx,                 // 7
      gy,                 // 8
      gz,                 // 9

      userAccTms,         // 10
      lastUserAx,         // 11
      lastUserAy,         // 12
      lastUserAz,         // 13

      gravTms,            // 14
      lastGravX,          // 15
      lastGravY,          // 16
      lastGravZ,          // 17

      attTms,             // 18
      lastRoll,           // 19
      lastPitch,          // 20
      lastYaw             // 21
    )

    samples.add(row)

    if (mode == "tug") {
      processTugRow(row, tMs)
    }
  }

  private fun canAcceptRowAtGyroSensorNs(gyroSensorNs: Long): Boolean {
    if (!hasAccelSample) return false

    val maxAgeMs = max(35.0, targetDtMs * 2.5)
    val accAgeMs = nsDeltaToMs(gyroSensorNs - lastAccSensorNs)
    if (accAgeMs < 0.0 || accAgeMs > maxAgeMs) return false

    if (linearAccelerationSensor != null && gravitySensor != null && rotationVectorSensor != null) {
      if (!hasUserAccSample || !hasGravSample || !hasAttSample) return false

      val userAgeMs = nsDeltaToMs(gyroSensorNs - lastUserAccSensorNs)
      val gravAgeMs = nsDeltaToMs(gyroSensorNs - lastGravSensorNs)
      val attAgeMs = nsDeltaToMs(gyroSensorNs - lastAttSensorNs)

      if (userAgeMs < 0.0 || userAgeMs > maxAgeMs) return false
      if (gravAgeMs < 0.0 || gravAgeMs > maxAgeMs) return false
      if (attAgeMs < 0.0 || attAgeMs > maxAgeMs) return false
    }

    return true
  }

  private fun updateAgeStatsForGyroSensorNs(gyroSensorNs: Long) {
    val accAge = max(0.0, nsDeltaToMs(gyroSensorNs - lastAccSensorNs))
    accAgeSumMs += accAge
    accAgeCount += 1
    if (accAge > accAgeMaxMs) accAgeMaxMs = accAge

    if (hasUserAccSample) {
      val age = max(0.0, nsDeltaToMs(gyroSensorNs - lastUserAccSensorNs))
      userAccAgeSumMs += age
      userAccAgeCount += 1
      if (age > userAccAgeMaxMs) userAccAgeMaxMs = age
    }

    if (hasGravSample) {
      val age = max(0.0, nsDeltaToMs(gyroSensorNs - lastGravSensorNs))
      gravAgeSumMs += age
      gravAgeCount += 1
      if (age > gravAgeMaxMs) gravAgeMaxMs = age
    }

    if (hasAttSample) {
      val age = max(0.0, nsDeltaToMs(gyroSensorNs - lastAttSensorNs))
      attAgeSumMs += age
      attAgeCount += 1
      if (age > attAgeMaxMs) attAgeMaxMs = age
    }
  }

  private fun processTugRow(row: DoubleArray, tMs: Double) {
    val gx = row[7]
    val gy = row[8]
    val gz = row[9]

    val userAx = row[11]
    val userAy = row[12]
    val userAz = row[13]

    val gravX = row[15]
    val gravY = row[16]
    val gravZ = row[17]

    val roll = row[19]
    val pitch = row[20]
    val yaw = row[21]

    val gyroNorm = sqrt(gx * gx + gy * gy + gz * gz)
    val userAccNorm = sqrt(userAx * userAx + userAy * userAy + userAz * userAz)
    val gravNorm = sqrt(gravX * gravX + gravY * gravY + gravZ * gravZ)

    if (!tugHasBaseline) {
      updateBaselineWithRow(
        row = row,
        gyroNorm = gyroNorm,
        userAccNorm = userAccNorm,
        gravNorm = gravNorm,
        roll = roll,
        pitch = pitch,
        yaw = yaw
      )
      if (!tugHasBaseline) return
    }

    val pitchRel = abs(angleDelta(pitch, baselinePitch))
    val rollRel = abs(angleDelta(roll, baselineRoll))
    val yawRel = abs(angleDelta(yaw, baselineYaw))

    val movedAway =
      gyroNorm > maxOf(1.2, baselineGyroNorm + 0.8) ||
        userAccNorm > maxOf(0.18, baselineUserAccNorm + 0.12) ||
        pitchRel > 0.20 ||
        rollRel > 0.20 ||
        yawRel > 0.35

    if (!tugHasLeftBaseline) {
      if (movedAway) {
        tugHasLeftBaseline = true
        tugStartDetectedMs = tMs
      }
      return
    }

    val elapsedSinceStart = tMs - tugStartDetectedMs
    if (elapsedSinceStart < 2500.0) return

    val stableNow =
      gyroNorm < maxOf(0.60, baselineGyroNorm + 0.30) &&
        userAccNorm < maxOf(0.12, baselineUserAccNorm + 0.07) &&
        pitchRel < 0.20 &&
        rollRel < 0.20

    if (stableNow) {
      if (tugFinishStillnessBeganMs <= 0.0) {
        tugFinishStillnessBeganMs = tMs
      }

      if ((tMs - tugFinishStillnessBeganMs) >= 900.0) {
        tugEndDetectedMs = tugFinishStillnessBeganMs
        autoStop("auto_finish")
        return
      }
    } else {
      tugFinishStillnessBeganMs = 0.0
    }

    if (elapsedSinceStart >= 20000.0) {
      tugEndDetectedMs = tMs
      autoStop("auto_timeout")
      return
    }
  }

  private fun updateBaselineWithRow(
    row: DoubleArray,
    gyroNorm: Double,
    userAccNorm: Double,
    gravNorm: Double,
    roll: Double,
    pitch: Double,
    yaw: Double
  ) {
    if (baselineRows.size < BASELINE_WARMUP_COUNT) {
      baselineRows.add(row.copyOf())
      recomputeBaseline()
      if (baselineRows.size >= BASELINE_TARGET_COUNT) {
        tugHasBaseline = true
      }
      return
    }

    val pitchRel = abs(angleDelta(pitch, baselinePitch))
    val rollRel = abs(angleDelta(roll, baselineRoll))
    val yawRel = abs(angleDelta(yaw, baselineYaw))

    val stableForBaseline =
      gyroNorm < maxOf(0.60, baselineGyroNorm + 0.25) &&
        userAccNorm < maxOf(0.10, baselineUserAccNorm + 0.06) &&
        abs(gravNorm - baselineGravityNorm) < 0.10 &&
        pitchRel < 0.10 &&
        rollRel < 0.10 &&
        yawRel < 0.18

    if (!stableForBaseline) {
      baselineRows.clear()
      baselinePitch = 0.0
      baselineRoll = 0.0
      baselineYaw = 0.0
      baselineGravityNorm = 1.0
      baselineUserAccNorm = 0.0
      baselineGyroNorm = 0.0
      return
    }

    baselineRows.add(row.copyOf())
    recomputeBaseline()

    if (baselineRows.size >= BASELINE_TARGET_COUNT) {
      tugHasBaseline = true
    }
  }

  private fun recomputeBaseline() {
    if (baselineRows.isEmpty()) return

    var sumPitch = 0.0
    var sumRoll = 0.0
    var sumYaw = 0.0
    var sumGyro = 0.0
    var sumUser = 0.0
    var sumGrav = 0.0

    for (row in baselineRows) {
      val gx = row[7]
      val gy = row[8]
      val gz = row[9]

      val userAx = row[11]
      val userAy = row[12]
      val userAz = row[13]

      val gravX = row[15]
      val gravY = row[16]
      val gravZ = row[17]

      val roll = row[19]
      val pitch = row[20]
      val yaw = row[21]

      sumPitch += pitch
      sumRoll += roll
      sumYaw += yaw
      sumGyro += sqrt(gx * gx + gy * gy + gz * gz)
      sumUser += sqrt(userAx * userAx + userAy * userAy + userAz * userAz)
      sumGrav += sqrt(gravX * gravX + gravY * gravY + gravZ * gravZ)
    }

    val n = baselineRows.size.toDouble()
    baselinePitch = sumPitch / n
    baselineRoll = sumRoll / n
    baselineYaw = sumYaw / n
    baselineGyroNorm = sumGyro / n
    baselineUserAccNorm = sumUser / n
    baselineGravityNorm = sumGrav / n
  }

  private fun autoStop(reason: String) {
    if (!running) return

    running = false
    sessionId += 1L
    unregisterAll()

    val result = buildResultMap(reason)
    emitAutoStop(result)
  }

  private fun emitAutoStop(result: WritableMap) {
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("NativeIMUAutoStop", result)
  }

  private fun relativeMsFromSensorNs(sensorNs: Long): Double {
    if (!hasFirstAcceptedSample || sensorNs <= 0L) return 0.0
    val deltaNs = sensorNs - firstAcceptedSensorNs
    return if (deltaNs <= 0L) 0.0 else deltaNs / 1_000_000.0
  }

  private fun nsDeltaToMs(deltaNs: Long): Double {
    return deltaNs / 1_000_000.0
  }

  private fun unregisterAll() {
    try {
      sensorManager.unregisterListener(this)
    } catch (_: Exception) {
    }
  }

  private fun internalReset() {
    samples.clear()
    acceptedDtMs.clear()
    baselineRows.clear()

    lastAx = 0.0
    lastAy = 0.0
    lastAz = 0.0

    lastUserAx = 0.0
    lastUserAy = 0.0
    lastUserAz = 0.0

    lastGravX = 0.0
    lastGravY = 0.0
    lastGravZ = 0.0

    lastRoll = 0.0
    lastPitch = 0.0
    lastYaw = 0.0

    lastAccSensorNs = 0L
    lastGyroSensorNs = 0L
    lastUserAccSensorNs = 0L
    lastGravSensorNs = 0L
    lastAttSensorNs = 0L

    hasAccelSample = false
    hasUserAccSample = false
    hasGravSample = false
    hasAttSample = false

    lastAcceptedTms = Double.NaN

    startWallMs = 0L
    firstAcceptedSensorNs = 0L
    hasFirstAcceptedSample = false

    accAgeSumMs = 0.0
    accAgeMaxMs = 0.0
    accAgeCount = 0

    userAccAgeSumMs = 0.0
    userAccAgeMaxMs = 0.0
    userAccAgeCount = 0

    gravAgeSumMs = 0.0
    gravAgeMaxMs = 0.0
    gravAgeCount = 0

    attAgeSumMs = 0.0
    attAgeMaxMs = 0.0
    attAgeCount = 0

    tugHasBaseline = false
    tugHasLeftBaseline = false
    tugStartDetectedMs = 0.0
    tugEndDetectedMs = 0.0
    tugFinishStillnessBeganMs = 0.0

    baselinePitch = 0.0
    baselineRoll = 0.0
    baselineYaw = 0.0
    baselineGravityNorm = 1.0
    baselineUserAccNorm = 0.0
    baselineGyroNorm = 0.0
  }

  private fun buildResultMap(stopReason: String): WritableMap {
    val result = Arguments.createMap()
    val stats = buildStatsMap()
    val jsSamples = Arguments.createArray()

    for (row in samples) {
      val line = Arguments.createArray()
      for (v in row) {
        line.pushDouble(v)
      }
      jsSamples.pushArray(line)
    }

    result.putArray("samples", jsSamples)
    result.putMap("stats", stats)

    if (mode == "tug") {
      val tug = Arguments.createMap()
      val detected = tugHasLeftBaseline && tugEndDetectedMs > tugStartDetectedMs

      tug.putBoolean("detected", detected)
      tug.putDouble("startDetectedMs", if (tugStartDetectedMs > 0.0) tugStartDetectedMs else 0.0)
      tug.putDouble("endDetectedMs", if (tugEndDetectedMs > 0.0) tugEndDetectedMs else 0.0)
      tug.putDouble("durationMs", if (detected) tugEndDetectedMs - tugStartDetectedMs else 0.0)
      tug.putString("stopReason", stopReason)

      result.putMap("tug", tug)
    }

    return result
  }

  private fun buildStatsMap(): WritableMap {
    val map = Arguments.createMap()
    val n = samples.size

    map.putInt("n", n)

    val accAgeMean = if (accAgeCount > 0) accAgeSumMs / accAgeCount.toDouble() else 0.0
    val userAccAgeMean = if (userAccAgeCount > 0) userAccAgeSumMs / userAccAgeCount.toDouble() else 0.0
    val gravAgeMean = if (gravAgeCount > 0) gravAgeSumMs / gravAgeCount.toDouble() else 0.0
    val attAgeMean = if (attAgeCount > 0) attAgeSumMs / attAgeCount.toDouble() else 0.0

    if (acceptedDtMs.isEmpty()) {
      map.putDouble("hzMean", 0.0)
      map.putDouble("dtMeanMs", 0.0)
      map.putDouble("dtMinMs", 0.0)
      map.putDouble("dtMaxMs", 0.0)
      map.putDouble("pctIn58to62", 0.0)
      map.putInt("droppedEstimated", 0)

      map.putDouble("targetHz", targetHz)
      map.putDouble("targetDtMs", targetDtMs)
      map.putInt("dtCount", 0)

      map.putDouble("accAgeMeanMs", accAgeMean)
      map.putDouble("accAgeMaxMs", accAgeMaxMs)
      map.putDouble("userAccAgeMeanMs", userAccAgeMean)
      map.putDouble("userAccAgeMaxMs", userAccAgeMaxMs)
      map.putDouble("gravAgeMeanMs", gravAgeMean)
      map.putDouble("gravAgeMaxMs", gravAgeMaxMs)
      map.putDouble("attAgeMeanMs", attAgeMean)
      map.putDouble("attAgeMaxMs", attAgeMaxMs)

      return map
    }

    var sum = 0.0
    var minDt = Double.POSITIVE_INFINITY
    var maxDt = Double.NEGATIVE_INFINITY
    var in58to62 = 0
    var droppedEstimated = 0

    for (dt in acceptedDtMs) {
      sum += dt
      if (dt < minDt) minDt = dt
      if (dt > maxDt) maxDt = dt

      val hz = if (dt > 0) 1000.0 / dt else 0.0
      if (hz in 58.0..62.0) {
        in58to62++
      }

      val expectedSlots = dt / targetDtMs
      if (expectedSlots > 1.5) {
        val extra = maxOf(0, expectedSlots.roundToInt() - 1)
        droppedEstimated += extra
      }
    }

    val dtMean = sum / acceptedDtMs.size.toDouble()
    val hzMean = if (dtMean > 0.0) 1000.0 / dtMean else 0.0
    val pctIn58to62 = (in58to62.toDouble() / acceptedDtMs.size.toDouble()) * 100.0

    map.putDouble("hzMean", hzMean)
    map.putDouble("dtMeanMs", dtMean)
    map.putDouble("dtMinMs", minDt)
    map.putDouble("dtMaxMs", maxDt)
    map.putDouble("pctIn58to62", pctIn58to62)
    map.putInt("droppedEstimated", droppedEstimated)

    map.putDouble("targetHz", targetHz)
    map.putDouble("targetDtMs", targetDtMs)
    map.putInt("dtCount", acceptedDtMs.size)

    map.putDouble("accAgeMeanMs", accAgeMean)
    map.putDouble("accAgeMaxMs", accAgeMaxMs)
    map.putDouble("userAccAgeMeanMs", userAccAgeMean)
    map.putDouble("userAccAgeMaxMs", userAccAgeMaxMs)
    map.putDouble("gravAgeMeanMs", gravAgeMean)
    map.putDouble("gravAgeMaxMs", gravAgeMaxMs)
    map.putDouble("attAgeMeanMs", attAgeMean)
    map.putDouble("attAgeMaxMs", attAgeMaxMs)

    return map
  }

  private fun angleDelta(value: Double, ref: Double): Double {
    var d = value - ref
    while (d > Math.PI) d -= 2.0 * Math.PI
    while (d < -Math.PI) d += 2.0 * Math.PI
    return d
  }
}

