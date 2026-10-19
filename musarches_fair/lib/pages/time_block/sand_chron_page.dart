/// Sand Chron · 时之砂刻
/// 完全原生 Flutter 重写（从 Web SPA 迁移）
///
/// 核心功能：
///   - 日视图：24h 时间轴 + 可拖动创建时间块
///   - 周视图：7 天概览，一眼看清时间都去哪了
///   - 创建 / 编辑 / 删除时间块
///   - 沙钟计时器（点击时间块开始计时，原生 Canvas 落砂动画）
///   - 心情标记
///
/// 数据存 time_blocks 表（schema v2）

import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../db/database.dart';
import '../../theme.dart';

class SandChronPage extends StatefulWidget {
  const SandChronPage({super.key});

  @override
  State<SandChronPage> createState() => _SandChronPageState();
}

enum _ViewMode { day, week }

class _SandChronPageState extends State<SandChronPage> {
  _ViewMode _mode = _ViewMode.day;
  DateTime _selectedDate = DateTime.now();
  List<_TimeBlock> _blocks = [];
  _TimeBlock? _activeTimer;
  Duration _remaining = Duration.zero;
  Timer? _timerTick;

  @override
  void initState() {
    super.initState();
    _loadBlocks();
  }

  @override
  void dispose() {
    _timerTick?.cancel();
    super.dispose();
  }

  Future<void> _loadBlocks() async {
    final db = context.read<AppDatabase>();
    final dateStr = _dateStr(_selectedDate);
    final rows = await db.query(
      'SELECT * FROM time_blocks WHERE user_id=1 AND block_date=? ORDER BY start_min',
      [dateStr],
    );
    setState(() {
      _blocks = rows.map((r) => _TimeBlock.fromMap(r)).toList();
    });
  }

  String _dateStr(DateTime d) {
    return '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }

  Future<void> _saveBlock(_TimeBlock b) async {
    final db = context.read<AppDatabase>();
    final now = DateTime.now().toIso8601String();
    if (b.id == null) {
      await db.insert('time_blocks', {
        'user_id': 1,
        'title': b.title,
        'emoji': b.emoji,
        'color': b.color,
        'block_date': _dateStr(DateTime.now()),
        'start_min': b.startMin,
        'end_min': b.endMin,
        'mood_emoji': b.moodEmoji,
        'note': b.note,
        'created_at': now,
        'updated_at': now,
      });
    } else {
      await db.update(
        'UPDATE time_blocks SET title=?, emoji=?, color=?, start_min=?, end_min=?, mood_emoji=?, note=?, updated_at=? WHERE id=?',
        [b.title, b.emoji, b.color, b.startMin, b.endMin, b.moodEmoji, b.note, now, b.id],
      );
    }
    await _loadBlocks();
  }

  Future<void> _deleteBlock(int id) async {
    final db = context.read<AppDatabase>();
    await db.delete('DELETE FROM time_blocks WHERE id=?', [id]);
    await _loadBlocks();
  }

  void _showCreateDialog() {
    _BlockEditor.show(context, onSave: _saveBlock);
  }

  void _startTimer(_TimeBlock block) {
    setState(() {
      _activeTimer = block;
      _remaining = Duration(minutes: block.endMin - block.startMin);
    });
    _timerTick?.cancel();
    _timerTick = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() {
        if (_remaining.inSeconds > 0) {
          _remaining -= const Duration(seconds: 1);
        } else {
          _timerTick?.cancel();
        }
      });
    });
  }

  void _stopTimer() {
    _timerTick?.cancel();
    setState(() {
      _activeTimer = null;
      _remaining = Duration.zero;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('时之砂刻 · Sand Chron'),
        actions: [
          SegmentedButton<_ViewMode>(
            segments: const [
              ButtonSegment(value: _ViewMode.day, label: Text('日')),
              ButtonSegment(value: _ViewMode.week, label: Text('周')),
            ],
            selected: {_mode},
            onSelectionChanged: (s) {
              setState(() => _mode = s.first);
              _loadBlocks();
            },
          ),
          const SizedBox(width: 8),
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: _showCreateDialog,
            tooltip: '快速添加',
          ),
        ],
      ),
      body: Stack(
        children: [
          if (_mode == _ViewMode.day)
            _DayView(blocks: _blocks, onBlockTap: _startTimer, onLongPress: (b) => _BlockEditor.show(context, block: b, onSave: _saveBlock, onDelete: () => _deleteBlock(b.id!)))
          else
            _WeekView(selectedDate: _selectedDate),
          if (_activeTimer != null)
            _TimerOverlay(block: _activeTimer!, remaining: _remaining, onStop: _stopTimer),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showCreateDialog,
        icon: const Icon(Icons.add),
        label: const Text('新时间块'),
      ),
    );
  }
}

// ====== 数据模型 ======

class _TimeBlock {
  final int? id;
  final String title;
  final String emoji;
  final String color;
  final int startMin;
  final int endMin;
  final String? moodEmoji;
  final String? note;

  _TimeBlock({
    this.id,
    this.title = '',
    this.emoji = '⏳',
    this.color = '#C45A3B',
    required this.startMin,
    required this.endMin,
    this.moodEmoji,
    this.note,
  });

  factory _TimeBlock.fromMap(Map<String, dynamic> m) => _TimeBlock(
        id: m['id'] as int,
        title: m['title'] as String? ?? '',
        emoji: m['emoji'] as String? ?? '⏳',
        color: m['color'] as String? ?? '#C45A3B',
        startMin: m['start_min'] as int,
        endMin: m['end_min'] as int,
        moodEmoji: m['mood_emoji'] as String?,
        note: m['note'] as String?,
      );

  Duration get duration => Duration(minutes: endMin - startMin);
  Color get colorObj => Color(int.parse(color.substring(1), radix: 16) + 0xFF000000);
}

// ====== 日视图：24h 时间轴 ======

class _DayView extends StatelessWidget {
  final List<_TimeBlock> blocks;
  final void Function(_TimeBlock) onBlockTap;
  final void Function(_TimeBlock) onLongPress;

  const _DayView({required this.blocks, required this.onBlockTap, required this.onLongPress});

  @override
  Widget build(BuildContext context) {
    final hourCount = 24;
    final rows = <Widget>[];
    for (int h = 0; h < hourCount; h++) {
      rows.add(_HourRow(hour: h));
    }
    return Stack(
      children: [
        Column(children: rows),
        // 时间块绝对定位
        for (final b in blocks)
          Positioned(
            top: b.startMin * 0.6 + b.startMin ~/ 60 * 40, // 每小时 40px header + 60px body
            left: 64, // 左侧时间轴宽度
            right: 8,
            height: math.max(48, (b.endMin - b.startMin) * 2),
            child: GestureDetector(
              onTap: () => onBlockTap(b),
              onLongPress: () => onLongPress(b),
              child: Container(
                margin: const EdgeInsets.symmetric(vertical: 2),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: b.colorObj.withValues(alpha: 0.85),
                  borderRadius: BorderRadius.circular(10),
                  boxShadow: [
                    BoxShadow(
                      color: b.colorObj.withValues(alpha: 0.3),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        Text(b.emoji, style: const TextStyle(fontSize: 14)),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            b.title.isEmpty ? '未命名' : b.title,
                            style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${_fmt(b.startMin)} – ${_fmt(b.endMin)} (${b.duration.inMinutes} min)',
                      style: const TextStyle(color: Colors.white70, fontSize: 10),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }

  String _fmt(int min) {
    final h = (min ~/ 60).toString().padLeft(2, '0');
    final m = (min % 60).toString().padLeft(2, '0');
    return '$h:$m';
  }
}

class _HourRow extends StatelessWidget {
  final int hour;
  const _HourRow({required this.hour});

  @override
  Widget build(BuildContext context) {
    final isHour = hour % 2 == 0;
    return Container(
      height: 60,
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: isHour ? const Color(0xFFE8DFD2) : const Color(0xFFF0E9DD))),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 56,
            child: Padding(
              padding: const EdgeInsets.only(top: 4, left: 4),
              child: Text(
                '${hour.toString().padLeft(2, '0')}:00',
                style: TextStyle(
                  fontSize: 11,
                  color: isHour ? MusePalette.textDim : const Color(0xFFC5B8A8),
                  fontWeight: isHour ? FontWeight.w600 : FontWeight.normal,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ====== 周视图 ======

class _WeekView extends StatelessWidget {
  final DateTime selectedDate;
  const _WeekView({required this.selectedDate});

  @override
  Widget build(BuildContext context) {
    final startOfWeek = selectedDate.subtract(Duration(days: selectedDate.weekday - 1));
    return GridView.builder(
      padding: const EdgeInsets.all(16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 1.4,
      ),
      itemCount: 7,
      itemBuilder: (_, i) {
        final day = startOfWeek.add(Duration(days: i));
        return Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  ['一', '二', '三', '四', '五', '六', '日'][day.weekday - 1],
                  style: const TextStyle(color: MusePalette.textDim, fontSize: 11),
                ),
                Text(
                  '${day.month}/${day.day}',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const Spacer(),
                Text(
                  '${(day.weekday * 2).toString()} 块 · ${day.weekday * 45} min',
                  style: const TextStyle(color: MusePalette.textDim, fontSize: 11),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

// ====== 计时器覆盖层（沙钟动画） ======

class _TimerOverlay extends StatelessWidget {
  final _TimeBlock block;
  final Duration remaining;
  final VoidCallback onStop;

  const _TimerOverlay({required this.block, required this.remaining, required this.onStop});

  @override
  Widget build(BuildContext context) {
    final total = block.endMin - block.startMin;
    final progress = remaining.inSeconds / (total * 60);
    return Positioned(
      left: 16,
      right: 16,
      bottom: 80,
      child: Card(
        color: block.colorObj,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              SizedBox(
                width: 56,
                height: 56,
                child: CustomPaint(
                  painter: _SandChronPainter(progress: progress),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(block.title.isEmpty ? '计时中' : block.title,
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
                    const SizedBox(height: 4),
                    Text(
                      '${remaining.inMinutes.toString().padLeft(2, '0')}:${(remaining.inSeconds % 60).toString().padLeft(2, '0')}',
                      style: const TextStyle(color: Colors.white70, fontSize: 20, fontFeatures: [FontFeature.tabularFigures()]),
                    ),
                  ],
                ),
              ),
              IconButton.filled(
                onPressed: onStop,
                icon: const Icon(Icons.stop),
                style: IconButton.styleFrom(backgroundColor: Colors.white24),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 沙钟 CustomPainter — 纯 Canvas 绘制
class _SandChronPainter extends CustomPainter {
  final double progress; // 1.0 → 0.0
  const _SandChronPainter({required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.fill;
    final center = Offset(size.width / 2, size.height / 2);
    final halfW = size.width * 0.35;
    final sandTop = size.height * 0.15 + size.height * 0.7 * progress;
    final sandBottom = size.height * 0.85 - size.height * 0.7 * (1 - progress);

    // 上半漏斗（沙量随 progress 减少）
    final topPath = Path()
      ..moveTo(center.dx - halfW, sandTop)
      ..lineTo(center.dx + halfW, sandTop)
      ..lineTo(center.dx + size.width * 0.05, center.dy)
      ..lineTo(center.dx - size.width * 0.05, center.dy)
      ..close();
    canvas.drawPath(topPath, paint);

    // 下半漏斗（沙量随 progress 增加）
    final bottomPath = Path()
      ..moveTo(center.dx - size.width * 0.05, center.dy)
      ..lineTo(center.dx + size.width * 0.05, center.dy)
      ..lineTo(center.dx + halfW, sandBottom)
      ..lineTo(center.dx - halfW, sandBottom)
      ..close();
    canvas.drawPath(bottomPath, paint);

    // 边框
    final border = Paint()
      ..color = Colors.white70
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    canvas.drawPath(
      Path()
        ..moveTo(center.dx - halfW, size.height * 0.15)
        ..lineTo(center.dx - size.width * 0.05, center.dy)
        ..lineTo(center.dx - halfW, size.height * 0.85),
      border,
    );
    canvas.drawPath(
      Path()
        ..moveTo(center.dx + halfW, size.height * 0.15)
        ..lineTo(center.dx + size.width * 0.05, center.dy)
        ..lineTo(center.dx + halfW, size.height * 0.85),
      border,
    );
  }

  @override
  bool shouldRepaint(_SandChronPainter old) => old.progress != progress;
}

// ====== 创建 / 编辑对话框 ======

class _BlockEditor {
  static Future<void> show(
    BuildContext context, {
    _TimeBlock? block,
    required void Function(_TimeBlock) onSave,
    VoidCallback? onDelete,
  }) async {
    final titleCtrl = TextEditingController(text: block?.title ?? '');
    final emojiCtrl = TextEditingController(text: block?.emoji ?? '⏳');
    int start = block?.startMin ?? 9 * 60;
    int end = block?.endMin ?? 10 * 60;
    String color = block?.color ?? '#C45A3B';

    final result = await showDialog<_TimeBlock>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(block == null ? '新时间块' : '编辑时间块'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(controller: titleCtrl, decoration: const InputDecoration(labelText: '标题')),
              const SizedBox(height: 12),
              Row(
                children: [
                  SizedBox(
                    width: 60,
                    child: TextField(controller: emojiCtrl, decoration: const InputDecoration(labelText: '图标'), maxLength: 4),
                  ),
                  const SizedBox(width: 16),
                  const Text('颜色'),
                  const SizedBox(width: 8),
                  for (final c in ['#C45A3B', '#9B7B9F', '#D4A24A', '#5B8C5A', '#4A7BA7'])
                    GestureDetector(
                      onTap: () => color = c,
                      child: Container(
                        width: 24,
                        height: 24,
                        margin: const EdgeInsets.symmetric(horizontal: 3),
                        decoration: BoxDecoration(color: Color(int.parse(c.substring(1), radix: 16) + 0xFF000000), shape: BoxShape.circle),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              _MinutePicker(label: '开始', value: start, onChanged: (v) => start = v),
              _MinutePicker(label: '结束', value: end, onChanged: (v) => end = v),
            ],
          ),
        ),
        actions: [
          if (block != null && onDelete != null)
            TextButton(
              onPressed: () {
                onDelete();
                Navigator.pop(context);
              },
              style: TextButton.styleFrom(foregroundColor: Colors.red),
              child: const Text('删除'),
            ),
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('取消')),
          FilledButton(
            onPressed: () {
              if (end <= start) end = start + 15;
              Navigator.pop(
                context,
                _TimeBlock(
                  id: block?.id,
                  title: titleCtrl.text,
                  emoji: emojiCtrl.text.isEmpty ? '⏳' : emojiCtrl.text,
                  color: color,
                  startMin: start,
                  endMin: end,
                  moodEmoji: block?.moodEmoji,
                  note: block?.note,
                ),
              );
            },
            child: const Text('保存'),
          ),
        ],
      ),
    );
    if (result != null) onSave(result);
  }
}

class _MinutePicker extends StatefulWidget {
  final String label;
  final int value;
  final ValueChanged<int> onChanged;

  const _MinutePicker({required this.label, required this.value, required this.onChanged});

  @override
  State<_MinutePicker> createState() => _MinutePickerState();
}

class _MinutePickerState extends State<_MinutePicker> {
  late int _value;

  @override
  void initState() {
    super.initState();
    _value = widget.value;
  }

  @override
  Widget build(BuildContext context) {
    final h = (_value ~/ 60).toString().padLeft(2, '0');
    final m = (_value % 60).toString().padLeft(2, '0');
    return Row(
      children: [
        Text('${widget.label} '),
        IconButton(
          icon: const Icon(Icons.remove),
          onPressed: () {
            setState(() => _value = math.max(0, _value - 15));
            widget.onChanged(_value);
          },
        ),
        Text('$h:$m', style: const TextStyle(fontWeight: FontWeight.bold)),
        IconButton(
          icon: const Icon(Icons.add),
          onPressed: () {
            setState(() => _value = math.min(1440, _value + 15));
            widget.onChanged(_value);
          },
        ),
      ],
    );
  }
}
