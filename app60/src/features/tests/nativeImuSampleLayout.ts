/**
 * Amostra compacta do `imuStop` — `NativeImuSampleRow` (16 números).
 * Mesma leitura que sentar-levantar / marcha nos ResultScreens.
 */
export const IMU16 = {
  T_MS: 0,
  AX: 1,
  AY: 2,
  AZ: 3,
  GX: 4,
  GY: 5,
  GZ: 6,
  USER_AX: 7,
  USER_AY: 8,
  USER_AZ: 9,
  GRAV_X: 10,
  GRAV_Y: 11,
  GRAV_Z: 12,
  ROLL: 13,
  PITCH: 14,
  YAW: 15,
} as const;

/**
 * Layout expandido tipo CSV / nativo bruto (22 valores por linha).
 */
export const IMU22 = {
  WALL_T_MS: 0,
  ROW_T_MS: 1,
  ACC_T_MS: 2,
  AX: 3,
  AY: 4,
  AZ: 5,
  GYRO_T_MS: 6,
  GX: 7,
  GY: 8,
  GZ: 9,
  USER_ACC_T_MS: 10,
  USER_AX: 11,
  USER_AY: 12,
  USER_AZ: 13,
  GRAV_T_MS: 14,
  GRAV_X: 15,
  GRAV_Y: 16,
  GRAV_Z: 17,
  ATT_T_MS: 18,
  ROLL: 19,
  PITCH: 20,
  YAW: 21,
} as const;
