# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# WorkManager opens its generated Room database with reflection. Room's keep
# rules in this dependency graph do not retain the generated no-arg constructor
# under R8, so keep the class and its constructor intact for release startup.
-keep class androidx.work.impl.WorkDatabase_Impl { *; }

# Add any project specific keep options here:
