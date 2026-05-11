## Beckup NativeIMU

Esta pasta guarda uma cópia dos arquivos do módulo nativo `NativeIMU` (iOS + Android) e do wrapper JS/TS.

### Por que existe?
Com Expo, rodar `expo prebuild --clean` pode regenerar `ios/` e `android/` e apagar alterações locais não-versionadas.
Mantendo estes arquivos no Git, você consegue restaurar rápido.

### Arquivos guardados
- `ios/app60/NativeIMU.h`
- `ios/app60/NativeIMU.m`
- `ios/app60.xcodeproj/project.pbxproj` (registro no Xcode)
- `android/app/src/main/java/br/ufpr/app60/NativeIMU.kt`
- `android/app/src/main/java/br/ufpr/app60/NativeIMUPackage.kt`
- `android/app/src/main/java/br/ufpr/app60/MainApplication.kt` (registro do package)
- `src/services/sensors/nativeImu.ts` (wrapper do JS)

