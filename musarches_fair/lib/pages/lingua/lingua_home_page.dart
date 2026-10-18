/// Lingua Learn — 语言学习主页面
/// 语言选择 → 课程列表 → Lesson 列表 → 练习

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../db/database.dart';
import '../../db/lingua_repo.dart';
import '../../theme.dart';
import 'course_list_page.dart';

class LinguaHomePage extends StatefulWidget {
  const LinguaHomePage({super.key});

  @override
  State<LinguaHomePage> createState() => _LinguaHomePageState();
}

class _LinguaHomePageState extends State<LinguaHomePage> {
  List<dynamic> _languages = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final repo = LinguaRepo(context.read<AppDatabase>());
    final langs = await repo.listLanguages();
    if (!mounted) return;
    setState(() {
      _languages = langs;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('语言学习')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _languages.isEmpty
              ? _emptyState()
              : _langGrid(),
    );
  }

  Widget _emptyState() {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.language, size: 64, color: MusePalette.textDim),
          SizedBox(height: 16),
          Text('还没有种子数据，请检查 assets/seeds/',
              style: TextStyle(color: MusePalette.textDim)),
        ],
      ),
    );
  }

  Widget _langGrid() {
    return GridView.builder(
      padding: const EdgeInsets.all(16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 1.2,
      ),
      itemCount: _languages.length,
      itemBuilder: (_, i) {
        final lang = _languages[i];
        return Card(
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: () => Navigator.of(context).push(MaterialPageRoute(
              builder: (_) => CourseListPage(lang: lang),
            )),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(lang.flag, style: const TextStyle(fontSize: 32)),
                  const Spacer(),
                  Text(lang.name,
                      style: const TextStyle(
                          fontSize: 18, fontWeight: FontWeight.bold)),
                  Text(lang.nameNative,
                      style: const TextStyle(
                          fontSize: 12, color: MusePalette.textDim)),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
