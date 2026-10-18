/// 数据模型 — 对应 SQLite schema + seeds JSON

class Language {
  final String code;
  final String name;
  final String nameNative;
  final String flag;
  final String voice;
  final String intro;

  Language({
    required this.code,
    required this.name,
    required this.nameNative,
    required this.flag,
    required this.voice,
    required this.intro,
  });

  factory Language.fromMap(Map<String, dynamic> m) => Language(
        code: m['code'] as String,
        name: m['name'] as String,
        nameNative: m['name_native'] as String? ?? '',
        flag: m['flag'] as String? ?? '',
        voice: m['voice'] as String? ?? '',
        intro: m['intro'] as String? ?? '',
      );

  Map<String, dynamic> toMap() => {
        'code': code,
        'name': name,
        'name_native': nameNative,
        'flag': flag,
        'voice': voice,
        'intro': intro,
      };
}

class Course {
  final int? id;
  final String lang;
  final String level;
  final int levelOrder;
  final String title;
  final String subtitle;
  final String description;
  final String icon;
  final List<Lesson> lessons;

  Course({
    this.id,
    required this.lang,
    required this.level,
    this.levelOrder = 1,
    required this.title,
    this.subtitle = '',
    this.description = '',
    this.icon = '📘',
    this.lessons = const [],
  });

  factory Course.fromJson(Map<String, dynamic> j, String lang) => Course(
        lang: lang,
        level: j['level'] as String,
        levelOrder: j['level_order'] as int? ?? 1,
        title: j['title'] as String,
        subtitle: j['subtitle'] as String? ?? '',
        description: j['description'] as String? ?? '',
        icon: j['icon'] as String? ?? '📘',
        lessons: (j['lessons'] as List? ?? [])
            .map((l) => Lesson.fromJson(l as Map<String, dynamic>))
            .toList(),
      );

  factory Course.fromMap(Map<String, dynamic> m) => Course(
        id: m['id'] as int?,
        lang: m['lang'] as String,
        level: m['level'] as String,
        levelOrder: m['level_order'] as int? ?? 1,
        title: m['title'] as String,
        subtitle: m['subtitle'] as String? ?? '',
        description: m['description'] as String? ?? '',
        icon: m['icon'] as String? ?? '📘',
      );

  Map<String, dynamic> toMap() => {
        'lang': lang,
        'level': level,
        'level_order': levelOrder,
        'title': title,
        'subtitle': subtitle,
        'description': description,
        'icon': icon,
      };
}

class Lesson {
  final int? id;
  final int courseId;
  final String title;
  final String module;
  final int orderIndex;
  final int xp;
  final int durationMin;
  final String description;
  final List<Exercise> exercises;

  Lesson({
    this.id,
    this.courseId = 0,
    required this.title,
    required this.module,
    this.orderIndex = 1,
    this.xp = 10,
    this.durationMin = 5,
    this.description = '',
    this.exercises = const [],
  });

  factory Lesson.fromJson(Map<String, dynamic> j) => Lesson(
        title: j['title'] as String,
        module: j['module'] as String,
        orderIndex: j['order_index'] as int? ?? 1,
        xp: j['xp'] as int? ?? 10,
        durationMin: j['duration_min'] as int? ?? 5,
        description: j['description'] as String? ?? '',
        exercises: (j['exercises'] as List? ?? [])
            .map((e) => Exercise.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  factory Lesson.fromMap(Map<String, dynamic> m) => Lesson(
        id: m['id'] as int?,
        courseId: m['course_id'] as int,
        title: m['title'] as String,
        module: m['module'] as String,
        orderIndex: m['order_index'] as int? ?? 1,
        xp: m['xp'] as int? ?? 10,
        durationMin: m['duration_min'] as int? ?? 5,
        description: m['description'] as String? ?? '',
      );

  Map<String, dynamic> toMap(int courseId) => {
        'course_id': courseId,
        'title': title,
        'module': module,
        'order_index': orderIndex,
        'xp': xp,
        'duration_min': durationMin,
        'description': description,
      };
}

class Exercise {
  final int? id;
  final int orderIndex;
  final String type; // mcq / fill / speak / listen
  final String prompt;
  final String promptTranslation;
  final String? audio;
  final List<String>? options;
  final dynamic answer; // String or List
  final String explanation;
  final String hint;

  Exercise({
    this.id,
    this.orderIndex = 1,
    required this.type,
    required this.prompt,
    this.promptTranslation = '',
    this.audio,
    this.options,
    this.answer,
    this.explanation = '',
    this.hint = '',
  });

  factory Exercise.fromJson(Map<String, dynamic> j) => Exercise(
        orderIndex: j['order_index'] as int? ?? 1,
        type: j['type'] as String,
        prompt: j['prompt'] as String? ?? '',
        promptTranslation: j['prompt_translation'] as String? ?? '',
        audio: j['audio'] as String?,
        options: j['options'] == null
            ? null
            : List<String>.from(j['options'] as List),
        answer: j['answer'],
        explanation: j['explanation'] as String? ?? '',
        hint: j['hint'] as String? ?? '',
      );

  bool get isMcq => type == 'mcq';
  bool get isFill => type == 'fill';
  bool get isSpeak => type == 'speak';
}

class Word {
  final int? id;
  final String lang;
  final String? level;
  final String word;
  final String reading;
  final String meaning;
  final String pos;
  final String example;
  final String exampleTranslation;

  Word({
    this.id,
    required this.lang,
    this.level,
    required this.word,
    this.reading = '',
    required this.meaning,
    this.pos = '',
    this.example = '',
    this.exampleTranslation = '',
  });

  factory Word.fromJson(Map<String, dynamic> j, String lang) => Word(
        lang: lang,
        level: j['level'] as String?,
        word: j['word'] as String,
        reading: j['reading'] as String? ?? '',
        meaning: j['meaning'] as String,
        pos: j['pos'] as String? ?? '',
        example: j['example'] as String? ?? '',
        exampleTranslation: j['example_translation'] as String? ?? '',
      );
}

class PhraseRecord {
  final String id;
  final String phrase;
  final String simpleDef;
  final List<String> tokens;

  PhraseRecord({
    required this.id,
    required this.phrase,
    required this.simpleDef,
    this.tokens = const [],
  });

  factory PhraseRecord.fromJson(Map<String, dynamic> j) => PhraseRecord(
        id: j['id'] as String,
        phrase: j['phrase'] as String,
        simpleDef: j['simple_def'] as String,
        tokens: (j['tokens'] as List? ?? []).map((e) => e.toString()).toList(),
      );
}
