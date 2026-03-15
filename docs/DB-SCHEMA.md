# Kus Conjugator 2.0 — Схема базы данных

**БД:** `loryit_kus_conj`
**Схема:** `public`

---

## ER-диаграмма (текстовая)

```
┌─────────────┐       ┌──────────────────┐       ┌──────────────┐
│   verbs     │       │  verb_category   │       │  categories  │
├─────────────┤       ├──────────────────┤       ├──────────────┤
│ verb_id PK  │──┐    │ verb_category_id │    ┌──│ category_id  │
│ infinitive  │  └───>│ verb_id FK       │    │  │ mood         │
│             │       │ category_id FK   │<───┘  │ tense        │
│             │       │                  │       │ verb_category│
│             │       │                  │       │ verb_type    │
└─────────────┘       └──────────────────┘       └──────────────┘
       │                                                │
       │              ┌──────────────────┐              │
       │              │     forms        │              │
       │              ├──────────────────┤              │
       └─────────────>│ verb_id FK       │              │
                      │ category_id FK   │<─────────────┘
                      │ person_id FK     │<───┐
                      │ form             │    │
                      │ verb_category_   │    │
                      │   person_id PK   │    │
                      └──────────────────┘    │
                                              │
                      ┌──────────────────┐    │
                      │    persons       │    │
                      ├──────────────────┤    │
                      │ person_id PK     │────┘
                      │ label            │
                      └──────────────────┘
```

---

## Таблицы

### verbs
Глаголы (инфинитивы).

| Поле | Тип | Ограничения |
|------|-----|-------------|
| `verb_id` | `int` | PRIMARY KEY |
| `infinitive` | `text` | NOT NULL, UNIQUE |

### persons
Грамматические лица.

| Поле | Тип | Ограничения |
|------|-----|-------------|
| `person_id` | `int` | PRIMARY KEY |
| `label` | `text` | NOT NULL, UNIQUE |

Примеры: yo, tu, el/ella/usted, nosotros, vosotros, ellos/ustedes.

### categories
Грамматические категории (комбинации наклонение + время + категория глагола + тип).

| Поле | Тип | Ограничения |
|------|-----|-------------|
| `category_id` | `int` | PRIMARY KEY |
| `mood` | `text` | NOT NULL |
| `tense` | `text` | NOT NULL |
| `verb_category` | `text` | NOT NULL |
| `verb_type` | `text` | NOT NULL |

Ограничение: `UNIQUE (mood, tense, verb_category, verb_type)`.

### verb_category
Связь глагола с категорией (many-to-many).

| Поле | Тип | Ограничения |
|------|-----|-------------|
| `verb_category_id` | `text` | PRIMARY KEY, формат `verb_id_category_id` |
| `verb_id` | `int` | NOT NULL, FK → `verbs(verb_id)` |
| `category_id` | `int` | NOT NULL, FK → `categories(category_id)` |

Ограничение: `UNIQUE (verb_id, category_id)`.

### forms
Формы спряжения (конкретная форма глагола в категории для лица).

| Поле | Тип | Ограничения |
|------|-----|-------------|
| `verb_category_person_id` | `text` | PRIMARY KEY, формат `verb_id_category_id_person_id` |
| `verb_id` | `int` | NOT NULL, FK → `verbs(verb_id)` |
| `category_id` | `int` | NOT NULL, FK → `categories(category_id)` |
| `person_id` | `int` | NOT NULL, FK → `persons(person_id)` |
| `form` | `text` | NULL допустим (форма может отсутствовать) |

Ограничение: `UNIQUE (verb_id, category_id, person_id)`.

---

## Связи

```
verbs (1) ──── (N) verb_category (N) ──── (1) categories
                        │
                        │ verb_id + category_id
                        ▼
                      forms (N) ──── (1) persons
```

- Один глагол может участвовать во многих категориях через `verb_category`.
- Одна категория может содержать много глаголов через `verb_category`.
- Таблица `forms` связывает тройку `(verb, category, person)` с конкретной формой спряжения.
