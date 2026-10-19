/// LessonPage — 课程练习页
/// 原生 Flutter 重写（从 Web SPA 迁移）
/// 支持 mcq / fill / speak 三种题型 + 评分 + XP

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../db/database.dart';
import '../../db/lingua_repo.dart';
import '../../models/models.dart';
import '../../theme.dart';

class LessonPage extends StatefulWidget {
  final Course course;
  final Lesson lesson;
  const LessonPage({super.key, required this.course, required this.lesson});

  @override
  State<LessonPage> createState() => _LessonPageState();
}

class _LessonPageState extends State<LessonPage> {
  int _idx = 0;
  int _correct = 0;
  int _total = 0;
  bool _showHint = false;
  bool _showAnswer = false;
  final _fillCtrl = TextEditingController();
  String? _selectedMcq;

  Exercise get _ex => widget.lesson.exercises[_idx];
  bool get _isLast => _idx == widget.lesson.exercises.length - 1;

  @override
  void dispose() {
    _fillCtrl.dispose();
    super.dispose();
  }

  bool _checkAnswer() {
    final ex = _ex;
    String userAns;
    if (ex.isMcq) {
      userAns = _selectedMcq ?? '';
    } else if (ex.isFill) {
      userAns = _fillCtrl.text.trim();
    } else {
      userAns = _fillCtrl.text.trim();
    }
    final correct = ex.answer is String ? ex.answer : (ex.answer as List).join('|');
    _total++;
    final ok = userAns.toLowerCase() == correct.toLowerCase();
    if (ok) _correct++;
    setState(() {
      _showAnswer = true;
    });
    return ok;
  }

  void _next() {
    _fillCtrl.clear();
    _selectedMcq = null;
    setState(() {
      _showHint = false;
      _showAnswer = false;
      if (_isLast) {
        _complete();
      } else {
        _idx++;
      }
    });
  }

  Future<void> _complete() async {
    final score = (_total > 0) ? (_correct * 100 / _total).round() : 0;
    final repo = LinguaRepo(context.read<AppDatabase>());
    await repo.upsertProgress(
      userId: 1,
      lessonId: widget.lesson.id!,
      status: 'completed',
      bestScore: score,
    );
    if (!mounted) return;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => AlertDialog(
        title: Text(score >= 80 ? '🎉 完成！' : '完成'),
        content: Text('${widget.lesson.title}\n得分 $score%\n$ _correct / $_total 正确'),
        actions: [
          FilledButton(
            onPressed: () {
              Navigator.pop(context); // 关 dialog
              Navigator.pop(context); // 回 course list
            },
            child: const Text('继续'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final ex = _ex;
    return Scaffold(
      appBar: AppBar(
        title: Text('${widget.lesson.module} · ${_idx + 1}/${widget.lesson.exercises.length}'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 进度条
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: (_idx + 1) / widget.lesson.exercises.length,
                minHeight: 6,
                backgroundColor: MusePalette.parchment,
              ),
            ),
            const SizedBox(height: 24),
            // 题型标签
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: MusePalette.duskMauve.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(ex.type.toUpperCase(),
                  style: const TextStyle(color: MusePalette.duskMauve, fontSize: 12, fontWeight: FontWeight.w600)),
            ),
            const SizedBox(height: 16),
            // 题目
            Text(ex.prompt,
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, height: 1.4)),
            if (ex.promptTranslation.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(ex.promptTranslation,
                  style: const TextStyle(color: MusePalette.textDim, fontSize: 14)),
            ],
            const SizedBox(height: 24),
            // 答题区
            if (ex.isMcq) ...[
              for (final opt in ex.options ?? [])
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _optionButton(opt),
                ),
            ] else ...[
              TextField(
                controller: _fillCtrl,
                enabled: !_showAnswer,
                decoration: InputDecoration(
                  hintText: ex.isSpeak ? '点击麦克风开口说' : '输入你的答案',
                  suffixIcon: ex.isSpeak ? const Icon(Icons.mic) : null,
                ),
                onSubmitted: (_) {
                  if (!_showAnswer) _checkAnswer();
                },
              ),
            ],
            // 提示
            if (ex.hint.isNotEmpty)
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  onPressed: () => setState(() => _showHint = true),
                  child: const Text('💡 看提示'),
                ),
              ),
            if (_showHint)
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: MusePalette.goldenWheat.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text('💡 ${ex.hint}',
                    style: const TextStyle(color: MusePalette.goldenWheat)),
              ),
            // 结果
            if (_showAnswer) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: MusePalette.sunOrange.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('✅ 正确答案',
                        style: TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 4),
                    Text(ex.answer is String
                        ? ex.answer as String
                        : (ex.answer as List).join(', ')),
                    if (ex.explanation.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(ex.explanation,
                          style: const TextStyle(color: MusePalette.textDim, fontSize: 13)),
                    ],
                  ],
                ),
              ),
            ],
            const Spacer(),
            // 底部按钮
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _showAnswer
                        ? _next
                        : (ex.isMcq && _selectedMcq == null)
                            ? null
                            : _checkAnswer,
                    icon: Icon(_showAnswer ? Icons.arrow_forward : Icons.check),
                    label: Text(_showAnswer
                        ? (_isLast ? '完成' : '下一题')
                        : '提交'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _optionButton(String opt) {
    final selected = _selectedMcq == opt;
    final correctAns = _ex.answer is String ? _ex.answer as String : (_ex.answer as List).first;
    final isCorrect = opt == correctAns;
    final showColors = _showAnswer;

    return OutlinedButton(
      onPressed: _showAnswer ? null : () => setState(() => _selectedMcq = opt),
      style: OutlinedButton.styleFrom(
        alignment: Alignment.centerLeft,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        side: BorderSide(
          color: showColors
              ? (isCorrect
                  ? Colors.green
                  : selected
                      ? Colors.red
                      : Colors.grey.shade300)
              : selected
                  ? MusePalette.sunOrange
                  : Colors.grey.shade300,
        ),
        backgroundColor: showColors
            ? (isCorrect
                ? Colors.green.withValues(alpha: 0.1)
                : selected
                    ? Colors.red.withValues(alpha: 0.1)
                    : Colors.white)
            : selected
                ? MusePalette.sunOrange.withValues(alpha: 0.05)
                : Colors.white,
      ),
      child: Text(opt, style: const TextStyle(fontSize: 14)),
    );
  }
}
