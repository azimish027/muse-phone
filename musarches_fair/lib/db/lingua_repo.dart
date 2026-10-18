/// Repository + Seeds 导入
/// 首次启动时从 assets/seeds/*.json 导入种子数据
/// 日常使用通过 Repository CRUD

import 'dart:convert';
import 'package:flutter/services.dart' show rootBundle;
import 'package:sqflite/sqflite.dart';
import '../db/database.dart';
import '../models/models.dart';

class SeedLoader {
  final AppDatabase db;
  SeedLoader(this.db);

  Future<void> loadAll() async {
    final database = await db.db;
    final langCount = Sqflite.firstIntValue(
      await database.rawQuery('SELECT COUNT(*) AS n FROM languages'),
    );
    if (langCount != null && langCount > 0) return; // 已导入过

    await database.transaction((tx) async {
      await _loadLanguages(tx);
      await _loadPhrases(tx);
    });
  }

  Future<void> _loadLanguages(Transaction tx) async {
    const files = ['en', 'ja', 'ko'];
    for (final f in files) {
      try {
        final raw = await rootBundle.loadString('assets/seeds/$f.json');
        final data = jsonDecode(raw) as Map<String, dynamic>;
        final lang = data['language'] as Map<String, dynamic>;
        await tx.rawInsert(
          '''INSERT INTO languages (code,name,name_native,flag,voice,intro)
             VALUES (?,?,?,?,?,?)
             ON CONFLICT(code) DO UPDATE SET name=excluded.name,name_native=excluded.name_native,
               flag=excluded.flag, voice=excluded.voice, intro=excluded.intro''',
          [
            lang['code'], lang['name'], lang['name_native'],
            lang['flag'], lang['voice'], lang['intro'],
          ],
        );

        final courses = (data['courses'] as List? ?? [])
            .map((c) => Course.fromJson(c as Map<String, dynamic>, f))
            .toList();

        for (final course in courses) {
          await tx.rawInsert(
            '''INSERT INTO courses (lang,level,level_order,title,subtitle,description,icon)
               VALUES (?,?,?,?,?,?,?)
               ON CONFLICT(lang,level) DO UPDATE SET level_order=excluded.level_order,title=excluded.title,
                 subtitle=excluded.subtitle, description=excluded.description, icon=excluded.icon''',
            [
              course.lang, course.level, course.levelOrder,
              course.title, course.subtitle, course.description, course.icon,
            ],
          );
          final courseRow = await tx.rawQuery(
            'SELECT id FROM courses WHERE lang=? AND level=?',
            [course.lang, course.level],
          );
          final courseId = courseRow.first['id'] as int;

          for (final lesson in course.lessons) {
            await tx.rawInsert(
              '''INSERT INTO lessons (course_id,title,module,order_index,xp,duration_min,description)
                 VALUES (?,?,?,?,?,?,?)''',
              [
                courseId, lesson.title, lesson.module, lesson.orderIndex,
                lesson.xp, lesson.durationMin, lesson.description,
              ],
            );
            final lessonRow = await tx.rawQuery(
              'SELECT last_insert_rowid() AS id',
            );
            final lessonId = lessonRow.first['id'] as int;

            int idx = 1;
            for (final ex in lesson.exercises) {
              await tx.rawInsert(
                '''INSERT INTO exercises (lesson_id,order_index,type,prompt,prompt_translation,audio,options,answer,explanation,hint)
                   VALUES (?,?,?,?,?,?,?,?,?,?)''',
                [
                  lessonId, ex.orderIndex == 1 ? idx++ : ex.orderIndex,
                  ex.type, ex.prompt, ex.promptTranslation, ex.audio,
                  ex.options != null ? jsonEncode(ex.options) : null,
                  ex.answer is String ? ex.answer : jsonEncode(ex.answer ?? ''),
                  ex.explanation, ex.hint,
                ],
              );
            }
          }
        }

        final words = (data['words'] as List? ?? [])
            .map((w) => Word.fromJson(w as Map<String, dynamic>, f))
            .toList();
        for (final w in words) {
          await tx.rawInsert(
            '''INSERT INTO words (lang,level,word,reading,meaning,pos,example,example_translation)
               VALUES (?,?,?,?,?,?,?,?)''',
            [
              w.lang, w.level, w.word, w.reading, w.meaning,
              w.pos, w.example, w.exampleTranslation,
            ],
          );
        }
        print('✓ seed $f: ${courses.length} courses, ${words.length} words');
      } catch (e) {
        print('⚠ seed $f failed: $e');
      }
    }
  }

  Future<void> _loadPhrases(Transaction tx) async {
    try {
      final raw = await rootBundle.loadString('assets/seeds/phrases.json');
      final data = jsonDecode(raw) as Map<String, dynamic>;
      final phrases = data['phrases'] as List? ?? [];
      for (final p in phrases) {
        final phrase = PhraseRecord.fromJson(p as Map<String, dynamic>);
        await tx.rawInsert(
          '''INSERT INTO phrases (id,phrase,tokens,simple_def,examples,pitfalls,hint_script,grammar_tag,audio_path,blank_priority)
             VALUES (?,?,?,?,?,?,?,?,?,?)
             ON CONFLICT(id) DO UPDATE SET phrase=excluded.phrase,tokens=excluded.tokens,
               simple_def=excluded.simple_def,examples=excluded.examples,pitfalls=excluded.pitfalls,
               hint_script=excluded.hint_script,grammar_tag=excluded.grammar_tag,
               audio_path=excluded.audio_path,blank_priority=excluded.blank_priority''',
          [
            phrase.id, phrase.phrase, jsonEncode(phrase.tokens), phrase.simpleDef,
            jsonEncode([]), jsonEncode([]), '', null, null, jsonEncode([]),
          ],
        );
      }
      print('✓ seed phrases: ${phrases.length}');
    } catch (e) {
      print('⚠ phrases seed failed: $e');
    }
  }
}

class LinguaRepo {
  final AppDatabase db;
  LinguaRepo(this.db);

  Future<List<Language>> listLanguages() async {
    final rows = await db.query('SELECT * FROM languages ORDER BY code');
    return rows.map(Language.fromMap).toList();
  }

  Future<List<Course>> listCourses(String lang) async {
    final rows = await db.query(
      'SELECT * FROM courses WHERE lang=? ORDER BY level_order, id',
      [lang],
    );
    return rows.map(Course.fromMap).toList();
  }

  Future<List<Lesson>> listLessons(int courseId) async {
    final rows = await db.query(
      'SELECT * FROM lessons WHERE course_id=? ORDER BY order_index',
      [courseId],
    );
    return rows.map(Lesson.fromMap).toList();
  }

  Future<List<Exercise>> listExercises(int lessonId) async {
    final rows = await db.query(
      'SELECT * FROM exercises WHERE lesson_id=? ORDER BY order_index',
      [lessonId],
    );
    return rows.map((r) {
      final options = r['options'] == null
          ? null
          : (jsonDecode(r['options'] as String) as List).map((e) => e.toString()).toList();
      return Exercise(
        id: r['id'] as int?,
        orderIndex: r['order_index'] as int? ?? 1,
        type: r['type'] as String,
        prompt: r['prompt'] as String? ?? '',
        promptTranslation: r['prompt_translation'] as String? ?? '',
        audio: r['audio'] as String?,
        options: options,
        answer: r['answer'],
        explanation: r['explanation'] as String? ?? '',
        hint: r['hint'] as String? ?? '',
      );
    }).toList();
  }

  Future<int> upsertProgress({
    required int userId,
    required int lessonId,
    String status = 'completed',
    int bestScore = 100,
  }) async {
    final now = DateTime.now().toIso8601String();
    final existing = await db.query(
      'SELECT * FROM lesson_progress WHERE user_id=? AND lesson_id=?',
      [userId, lessonId],
    );
    if (existing.isNotEmpty) {
      return db.update(
        '''UPDATE lesson_progress SET status=?, best_score=MAX(best_score,?),
           completed_at=? WHERE user_id=? AND lesson_id=?''',
        [status, bestScore, now, userId, lessonId],
      );
    }
    return db.insert(
      'lesson_progress',
      {
        'user_id': userId,
        'lesson_id': lessonId,
        'status': status,
        'best_score': bestScore,
        'attempts': 1,
        'last_at': now,
        'completed_at': now,
      },
    );
  }

  Future<List<Word>> listWords({required String lang, String? level}) async {
    final where = level != null ? 'WHERE lang=? AND level=?' : 'WHERE lang=?';
    final args = level != null ? [lang, level] : [lang];
    final rows = await db.query('SELECT * FROM words $where', args);
    return rows.map((r) => Word.fromJson(r, lang)).toList();
  }

  Future<List<PhraseRecord>> listPhrases() async {
    final rows = await db.query('SELECT * FROM phrases ORDER BY id LIMIT 20');
    return rows.map((r) => PhraseRecord(
          id: r['id'] as String,
          phrase: r['phrase'] as String,
          simpleDef: r['simple_def'] as String,
          tokens: (jsonDecode(r['tokens'] as String) as List).map((e) => e.toString()).toList(),
        )).toList();
  }
}
