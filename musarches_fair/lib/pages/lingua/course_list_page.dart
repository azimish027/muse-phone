import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../db/database.dart';
import '../../db/lingua_repo.dart';
import '../../models/models.dart';
import '../../theme.dart';
import 'lesson_page.dart';

class CourseListPage extends StatefulWidget {
  final Language lang;
  const CourseListPage({super.key, required this.lang});

  @override
  State<CourseListPage> createState() => _CourseListPageState();
}

class _CourseListPageState extends State<CourseListPage> {
  List<Course> _courses = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final repo = LinguaRepo(context.read<AppDatabase>());
    final courses = await repo.listCourses(widget.lang.code);
    if (!mounted) return;
    // 加载每个 course 的 lessons 数量
    final enriched = <Course>[];
    for (final c in courses) {
      final lessons = await repo.listLessons(c.id!);
      // 从 lessons 反推填充 course.lessons 字段（带完整 exercises）
      final withExercises = <Lesson>[];
      for (final l in lessons) {
        final exs = await repo.listExercises(l.id!);
        withExercises.add(Lesson(
          id: l.id,
          courseId: l.courseId,
          title: l.title,
          module: l.module,
          orderIndex: l.orderIndex,
          xp: l.xp,
          durationMin: l.durationMin,
          description: l.description,
          exercises: exs,
        ));
      }
      enriched.add(Course(
        id: c.id,
        lang: c.lang,
        level: c.level,
        levelOrder: c.levelOrder,
        title: c.title,
        subtitle: c.subtitle,
        description: c.description,
        icon: c.icon,
        lessons: withExercises,
      ));
    }
    setState(() {
      _courses = enriched;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('${widget.lang.flag} ${widget.lang.name}')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _courses.isEmpty
              ? const Center(child: Text('暂无课程'))
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _courses.length,
                  itemBuilder: (_, i) => _courseCard(_courses[i]),
                ),
    );
  }

  Widget _courseCard(Course c) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: MusePalette.sunOrange.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Center(child: Text(c.icon, style: const TextStyle(fontSize: 22))),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${c.level} · ${c.title}',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      Text('${c.lessons.length} 节课 · ${_totalExercises(c)} 练习',
                          style: const TextStyle(color: MusePalette.textDim, fontSize: 12)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            // Lesson 列表（紧凑展开）
            ...c.lessons.asMap().entries.map((e) {
              final idx = e.key + 1;
              final lesson = e.value;
              return ListTile(
                dense: true,
                minLeadingWidth: 20,
                leading: Text('$idx',
                    style: const TextStyle(color: MusePalette.textDim, fontSize: 13)),
                title: Text(lesson.title, style: const TextStyle(fontSize: 14)),
                subtitle: Text('${lesson.module} · ${lesson.exercises.length} 练习',
                    style: const TextStyle(fontSize: 11, color: MusePalette.textDim)),
                trailing: Text('+${lesson.xp}XP',
                    style: const TextStyle(color: MusePalette.sunOrange, fontWeight: FontWeight.w600)),
                onTap: () => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => LessonPage(course: c, lesson: lesson),
                )),
              );
            }),
          ],
        ),
      ),
    );
  }

  int _totalExercises(Course c) =>
      c.lessons.fold<int>(0, (sum, l) => sum + l.exercises.length);
}
