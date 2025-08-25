const { 
  withDangerousMod, 
  withAppBuildGradle, 
  withMainApplication,
  withAndroidManifest,
  AndroidConfig
} = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

function withHeimanBluetooth(config) {
  
  // 1. Dodaj permissions do AndroidManifest.xml
  config = withAndroidManifest(config, (config) => {
    const permissions = [
      'android.permission.BLUETOOTH',
      'android.permission.BLUETOOTH_ADMIN', 
      'android.permission.BLUETOOTH_SCAN',
      'android.permission.BLUETOOTH_ADVERTISE',
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION'
    ];

    const androidManifest = config.modResults;
    const mainApplication = androidManifest.manifest;

    // Dodaj namespace dla tools jeśli nie istnieje
    if (!mainApplication.$) {
      mainApplication.$ = {};
    }
    if (!mainApplication.$['xmlns:tools']) {
      mainApplication.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    if (!mainApplication['uses-permission']) {
      mainApplication['uses-permission'] = [];
    }

    permissions.forEach(permission => {
      const exists = mainApplication['uses-permission'].some(
        perm => perm.$['android:name'] === permission
      );
      
      if (!exists) {
        const permissionObj = {
          $: { 'android:name': permission }
        };
        
        // Dodaj specjalne atrybuty dla Android 12+
        if (permission === 'android.permission.BLUETOOTH_SCAN') {
          permissionObj.$['android:usesPermissionFlags'] = 'neverForLocation';
          permissionObj.$['tools:targetApi'] = 's';
        }
        if (permission.includes('BLUETOOTH_') && 
            permission !== 'android.permission.BLUETOOTH' && 
            permission !== 'android.permission.BLUETOOTH_ADMIN') {
          permissionObj.$['tools:targetApi'] = 's';
        }
        
        mainApplication['uses-permission'].push(permissionObj);
      }
    });

    return config;
  });

  // 2. Dodaj AAR i inne dependencies do app/build.gradle
  config = withAppBuildGradle(config, (config) => {
    const buildGradle = config.modResults.contents;
    
    let modifiedContents = buildGradle;

    // Dodaj implementation dla AAR file
    const aarImplementation = "implementation fileTree(dir: 'libs', include: ['*.aar'])";
    if (!modifiedContents.includes(aarImplementation)) {
      modifiedContents = modifiedContents.replace(
        /dependencies\s*{/,
        `dependencies {
    ${aarImplementation}`
      );
    }

    // Dodaj inne potrzebne dependencies
    const additionalDeps = [
      "implementation 'com.google.code.gson:gson:2.13.1'",
      "implementation 'com.github.iwgang:familiarrecyclerview:1.3.5'"
    ];

    additionalDeps.forEach(dep => {
      if (!modifiedContents.includes(dep)) {
        modifiedContents = modifiedContents.replace(
          /dependencies\s*{/,
          `dependencies {
    ${dep}`
        );
      }
    });

    config.modResults.contents = modifiedContents;
    return config;
  });

  // 3. Dodaj package do MainApplication (skip for manual registration)
  // We'll handle this in the dangerous mod section

  // 4. Kopiuj pliki po prebuild
  config = withDangerousMod(config, [
    'android',
    (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const platformProjectRoot = config.modRequest.platformProjectRoot;
      const packageName = config.android?.package || 'com.yourcompany.yourapp';
      const packagePath = packageName.replace(/\./g, '/');
      
      // Ścieżki
      const templateDir = path.join(projectRoot, 'template-files/android');
      const targetJavaDir = path.join(
        platformProjectRoot, 
        'app/src/main/java',
        packagePath
      );
      const targetLibsDir = path.join(platformProjectRoot, 'app/libs');
      const sourceAarPath = path.join(projectRoot, 'assets/hmLinkSdk-release.aar');

      try {
        // Stwórz katalogi
        fs.mkdirSync(targetJavaDir, { recursive: true });
        fs.mkdirSync(targetLibsDir, { recursive: true });

        // Kopiuj AAR file
        if (fs.existsSync(sourceAarPath)) {
          const targetAarPath = path.join(targetLibsDir, 'hmLinkSdk-release.aar');
          fs.copyFileSync(sourceAarPath, targetAarPath);
          console.log('✅ Copied hmLinkSdk-release.aar');
        } else {
          console.warn('⚠️ AAR file not found at:', sourceAarPath);
        }

        // Kopiuj pliki Java
        if (fs.existsSync(templateDir)) {
          const files = fs.readdirSync(templateDir);
          files.forEach(file => {
            if (file.endsWith('.java')) {
              const sourcePath = path.join(templateDir, file);
              const targetPath = path.join(targetJavaDir, file);
              
              // Podmień package name w pliku
              let content = fs.readFileSync(sourcePath, 'utf8');
              content = content.replace(
                /package com\.yourcompany\.yourapp;/g,
                `package ${packageName};`
              );
              
              fs.writeFileSync(targetPath, content);
              console.log(`✅ Copied and processed ${file}`);
            }
          });
        } else {
          console.warn('⚠️ Template directory not found at:', templateDir);
        }

      } catch (error) {
        console.error('❌ Error in withHeimanBluetooth plugin:', error);
      }

      return config;
    },
  ]);

  return config;
}

module.exports = withHeimanBluetooth;