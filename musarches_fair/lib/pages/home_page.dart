/// 首页 — 昭和复古集市风格
/// 3 个摊位卡片：Time Block / RPG / Mind
///
/// 复用 apps.json 的品牌定义：
///   时之砂刻 Sand Chron（重写 Flutter 原生）
///   猎语征途 Hunter Quest （WebView）
///   星空梦想乡 Astral Hearth（WebView）

import 'package:flutter/material.dart';
import '../theme.dart';
import 'time_block/sand_chron_page.dart';
import 'web_view_page.dart';
import 'lingua/lingua_home_page.dart';

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('缪萨克斯集市'),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_outline),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('个人中心（开发中）')),
              );
            },
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          _buildHeader(),
          const SizedBox(height: 24),
          _buildStallGrid(context),
          const SizedBox(height: 16),
          _buildStats(context),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [MusePalette.sunOrange, MusePalette.duskMauve],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: MusePalette.sunOrange.withValues(alpha: 0.3),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '忒拉蓬 Therapōn Musarches',
            style: TextStyle(
              color: Colors.white70,
              fontSize: 12,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            '缪斯的大祭司',
            style: TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            '语言如咒语 · 心念则回响',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.85),
              fontSize: 13,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              _buildBadge('🔥 连续 0 天'),
              const SizedBox(width: 8),
              _buildBadge('⭐ XP 0'),
              const SizedBox(width: 8),
              _buildBadge('🎯 今日 0min'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBadge(String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(text,
          style: const TextStyle(color: Colors.white, fontSize: 11)),
    );
  }

  Widget _buildStallGrid(BuildContext context) {
    final stalls = [
      _StallConfig(
        icon: Icons.translate,
        emoji: '📘',
        name: '语言学习',
        nameEn: 'Lingua Learn',
        desc: '英/日/韩 · 课程体系 · 原生重写',
        why: '原 语缪 Musarches Fair 主站，纯 Flutter 原生体验',
        color: MusePalette.parchment,
        isNative: true,
        nativeBuilder: () => const LinguaHomePage(),
        webAssetPath: null,
      ),
      _StallConfig(
        icon: Icons.hourglass_top,
        emoji: '⏳',
        name: '时之砂刻',
        nameEn: 'Sand Chron',
        desc: '日周双视图 · 拖拽创建',
        why: '我自己的时间管理一直很糟，做一个让我一眼看清时间都去哪了的工具',
        color: MusePalette.sunOrange,
        isNative: true,
        nativeBuilder: () => const SandChronPage(),
        webAssetPath: null,
      ),
      _StallConfig(
        icon: Icons.catching_pokemon,
        emoji: '🏹',
        name: '猎语征途',
        nameEn: 'Hunter Quest',
        desc: '英语短语念成咒语 · 击败小妖怪',
        why: '学英语的最大敌人是无聊',
        color: MusePalette.goldenWheat,
        isNative: false,
        nativeBuilder: null,
        webAssetPath: 'assets/webviews/rpg/index.html',
      ),
      _StallConfig(
        icon: Icons.auto_awesome,
        emoji: '🌌',
        name: '星空梦想乡',
        nameEn: 'Astral Hearth',
        desc: '正念冥想 · 星球陪伴你的心流',
        why: '让大脑降温，画一颗星球慢慢转',
        color: MusePalette.duskMauve,
        isNative: false,
        nativeBuilder: null,
        webAssetPath: 'assets/webviews/mind/index.html',
      ),
    ];

    return Column(
      children: [
        const Align(
          alignment: Alignment.centerLeft,
          child: Text('集市 · 三个摊位',
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: MusePalette.inkGray)),
        ),
        const SizedBox(height: 12),
        for (final s in stalls) _StallCard(config: s),
      ],
    );
  }

  Widget _buildStats(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _statCell('课程', '0'),
            _statCell('短语', '0'),
            _statCell('成就', '0/14'),
            _statCell('连续', '0天'),
          ],
        ),
      ),
    );
  }

  Widget _statCell(String label, String value) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(value,
            style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: MusePalette.sunOrange)),
        const SizedBox(height: 4),
        Text(label,
            style: const TextStyle(color: MusePalette.textDim, fontSize: 11)),
      ],
    );
  }
}

// ====== Stall 卡片 ======

class _StallConfig {
  final IconData icon;
  final String emoji;
  final String name;
  final String nameEn;
  final String desc;
  final String why;
  final Color color;
  final bool isNative;
  final Widget Function()? nativeBuilder;
  final String? webAssetPath;

  _StallConfig({
    required this.icon,
    required this.emoji,
    required this.name,
    required this.nameEn,
    required this.desc,
    required this.why,
    required this.color,
    required this.isNative,
    required this.nativeBuilder,
    required this.webAssetPath,
  });
}

class _StallCard extends StatelessWidget {
  final _StallConfig config;
  const _StallCard({required this.config});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Card(
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => _open(context),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: config.color.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Center(
                    child: Text(config.emoji,
                        style: const TextStyle(fontSize: 28)),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(config.name,
                              style: const TextStyle(
                                  fontSize: 16, fontWeight: FontWeight.bold)),
                          const SizedBox(width: 8),
                          if (config.isNative)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: MusePalette.sunOrange.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: const Text('原生',
                                  style: TextStyle(
                                      fontSize: 10,
                                      color: MusePalette.sunOrange,
                                      fontWeight: FontWeight.w600)),
                            ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(config.nameEn,
                          style: const TextStyle(
                              fontSize: 11, color: MusePalette.textDim)),
                      const SizedBox(height: 6),
                      Text(config.desc,
                          style: const TextStyle(
                              fontSize: 13, color: MusePalette.inkGray)),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right, color: MusePalette.textDim),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _open(BuildContext context) {
    final Widget page;
    if (config.isNative && config.nativeBuilder != null) {
      page = config.nativeBuilder!();
    } else if (config.webAssetPath != null) {
      page = WebViewPage(
        title: config.name,
        assetPath: config.webAssetPath!,
      );
    } else {
      return;
    }
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => page),
    );
  }
}
