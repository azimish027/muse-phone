/// 缪萨克斯集市 Musarches Fair — Android App 入口
///
/// 架构：
///   - Flutter 主框架（Material 3）
///   - sqflite 本地 SQLite 单机存储
///   - Time Block → Flutter 原生重写（Sand Chron）
///   - RPG / Mind → flutter_inappwebview 嵌套现有 Web bundle
///   - Provider 轻量状态管理
///
/// 单机优先 + 可选云同步（当前版本无云，后续接入 Firebase）

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'theme.dart';
import 'db/database.dart';
import 'pages/home_page.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MusePhoneApp());
}

class MusePhoneApp extends StatelessWidget {
  const MusePhoneApp({super.key});

  @override
  Widget build(BuildContext context) {
    // Repository 全局单例（数据库已在首次访问时自动 open + seed）
    return Provider<AppDatabase>(
      create: (_) => AppDatabase.instance,
      child: MaterialApp(
        title: '缪萨克斯集市',
        debugShowCheckedModeBanner: false,
        theme: buildMuseTheme(),
        home: const SplashBridge(),
      ),
    );
  }
}

/// 启动桥：初始化数据库 → 跳转首页
class SplashBridge extends StatefulWidget {
  const SplashBridge({super.key});

  @override
  State<SplashBridge> createState() => _SplashBridgeState();
}

class _SplashBridgeState extends State<SplashBridge> {
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    // 触发数据库 open（onCreate 里会 seed achievements + 默认用户）
    await context.read<AppDatabase>().db;
    if (!mounted) return;
    setState(() => _ready = true);
  }

  @override
  Widget build(BuildContext context) {
    if (!_ready) {
      return const Scaffold(
        backgroundColor: MusePalette.parchment,
        body: Center(child: CircularProgressIndicator()),
      );
    }
    return const HomePage();
  }
}
