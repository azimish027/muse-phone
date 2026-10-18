/// 品牌主题 — 与 apps.json palette 保持一致
/// 昭和复古集市风：太阳橙 / 暮色紫 / 羊皮纸 / 金麦色

import 'package:flutter/material.dart';

class MusePalette {
  static const sunOrange = Color(0xFFC45A3B);
  static const duskMauve = Color(0xFF9B7B9F);
  static const inkGray = Color(0xFF5D5D5D);
  static const parchment = Color(0xFFF5EFE6);
  static const goldenWheat = Color(0xFFD4A24A);

  static const background = parchment;
  static const primary = sunOrange;
  static const secondary = duskMauve;
  static const accent = goldenWheat;
  static const text = inkGray;
  static const textDim = Color(0xFF9A8F85);
}

ThemeData buildMuseTheme() {
  const seed = Color(0xFFC45A3B);
  final base = ThemeData(
    useMaterial3: true,
    colorSchemeSeed: seed,
    brightness: Brightness.light,
  );
  return base.copyWith(
    scaffoldBackgroundColor: MusePalette.parchment,
    colorScheme: base.colorScheme.copyWith(
      primary: MusePalette.sunOrange,
      onPrimary: Colors.white,
      secondary: MusePalette.duskMauve,
      onSecondary: Colors.white,
      tertiary: MusePalette.goldenWheat,
      surface: MusePalette.parchment,
      error: const Color(0xFFB33A3A),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: MusePalette.parchment,
      foregroundColor: MusePalette.inkGray,
      elevation: 0,
      centerTitle: true,
    ),
    cardTheme: CardTheme(
      color: Colors.white,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0xFFE8DFD2), width: 1),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: MusePalette.sunOrange,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
        ),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFE8DFD2)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFE8DFD2)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: MusePalette.sunOrange, width: 2),
      ),
    ),
    textTheme: base.textTheme.apply(
      bodyColor: MusePalette.inkGray,
      displayColor: MusePalette.inkGray,
    ),
    dividerTheme: const DividerThemeData(
      color: Color(0xFFE8DFD2),
      thickness: 1,
    ),
  );
}
