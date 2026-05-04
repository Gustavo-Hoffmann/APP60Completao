/**
 * Coleta de movimento alinhada ao LoSCollector (MotionManager.swift):
 * acelerômetro (g) + giroscópio (rad/s) + DeviceMotion (gravidade / aceleração do usuário em m/s²).
 */
import { Accelerometer, DeviceMotion, Gyroscope } from "expo-sensors";

export type LosMotionSample = {
  timestampMs: number;
  elapsedSec: number;
  ax: number;
  ay: number;
  az: number;
  gx: number;
  gy: number;
  gz: number;
  userAx: number;
  userAy: number;
  userAz: number;
  gravX: number;
  gravY: number;
  gravZ: number;
  roll: number;
  pitch: number;
  yaw: number;
  gyroNorm: number;
  userAccNorm: number;
};

function hypot3(x: number, y: number, z: number) {
  return Math.sqrt(x * x + y * y + z * z);
}

export async function losMotionIsAvailable(): Promise<boolean> {
  const dm = await DeviceMotion.isAvailableAsync();
  const acc = await Accelerometer.isAvailableAsync();
  const gyro = await Gyroscope.isAvailableAsync();
  return dm && acc && gyro;
}

export function startLosMotionStream(
  sampleHz: number,
  onSample: (sample: LosMotionSample) => void
): { stop: () => void } {
  const intervalMs = Math.max(10, Math.round(1000 / sampleHz));

  Accelerometer.setUpdateInterval(intervalMs);
  Gyroscope.setUpdateInterval(intervalMs);
  DeviceMotion.setUpdateInterval(intervalMs);

  const t0 = Date.now();
  const accRef = { x: 0, y: 0, z: 0 };
  const gyroRef = { x: 0, y: 0, z: 0 };

  const subAcc = Accelerometer.addListener((a) => {
    accRef.x = a.x;
    accRef.y = a.y;
    accRef.z = a.z;
  });

  const subGyro = Gyroscope.addListener((g) => {
    gyroRef.x = g.x;
    gyroRef.y = g.y;
    gyroRef.z = g.z;
  });

  const subDm = DeviceMotion.addListener((dm) => {
    const now = Date.now();
    const elapsedSec = (now - t0) / 1000;

    const ax = accRef.x;
    const ay = accRef.y;
    const az = accRef.z;

    const gx = gyroRef.x;
    const gy = gyroRef.y;
    const gz = gyroRef.z;

    const inc = dm.accelerationIncludingGravity;
    const user = dm.acceleration;

    const userAx = user?.x ?? 0;
    const userAy = user?.y ?? 0;
    const userAz = user?.z ?? 0;

    const gvx = inc.x - userAx;
    const gvy = inc.y - userAy;
    const gvz = inc.z - userAz;

    const roll = Math.atan2(gvy, gvz);
    const pitch = Math.atan2(-gvx, Math.sqrt(gvy * gvy + gvz * gvz));
    const yaw = 0;

    const gyroNorm = hypot3(gx, gy, gz);
    const userAccNorm = hypot3(userAx, userAy, userAz);

    onSample({
      timestampMs: now,
      elapsedSec,
      ax,
      ay,
      az,
      gx,
      gy,
      gz,
      userAx,
      userAy,
      userAz,
      gravX: gvx,
      gravY: gvy,
      gravZ: gvz,
      roll,
      pitch,
      yaw,
      gyroNorm,
      userAccNorm,
    });
  });

  return {
    stop: () => {
      subAcc.remove();
      subGyro.remove();
      subDm.remove();
    },
  };
}
