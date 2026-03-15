# Kus Conjugator 2.0

Веб-тренажёр для отработки личных форм спряжения испанских глаголов.

## Стек

| Слой | Технологии |
|------|-----------|
| **Backend** | Python 3.x, FastAPI, uvicorn, psycopg2-binary, python-dotenv, pydantic |
| **Frontend** | React 19, Vite 8, TypeScript 5.9 |
| **БД** | PostgreSQL (схема `public`, БД `loryit_kus_conj`) |

## Быстрый старт

### 1. Настройка окружения

Создайте файл `.env` в корне проекта:

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=loryit_kus_conj
DB_USER=postgres
DB_PASSWORD=your_password_here
```

### 2. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate    # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Проверка: `GET http://localhost:8000/health` → `{"status":"ok"}`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Приложение доступно на `http://localhost:5173`.
Vite проксирует запросы `/api/*` на backend (`http://localhost:8000`).

## API-эндпоинты

| Метод | URL | Описание |
|-------|-----|----------|
| `GET` | `/api/categories` | Все категории для построения фильтров |
| `GET` | `/api/verbs?categoryIds=1,2` | Глаголы по выбранным категориям |
| `GET` | `/api/persons` | Список лиц (yo, tú, él/ella, ...) |
| `GET` | `/api/forms?verbId=5&categoryId=10` | Правильные формы спряжения |

Swagger UI доступен на `http://localhost:8000/docs`.

## Деплой в Google Cloud Run

Приложение деплоится как единый контейнер: фронтенд собирается в статику, FastAPI отдаёт и API, и статические файлы. Конфигурация — в `Dockerfile` (multi-stage build).

### Предварительные шаги

1. Создайте секреты в Google Secret Manager: `DB_HOST`, `DB_USER`, `DB_PASSWORD`.
2. Выдайте сервис-аккаунту Cloud Run роль **Secret Manager Secret Accessor**:

```bash
gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:<PROJECT_NUMBER>-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Деплой

```bash
gcloud run deploy <SERVICE_NAME> \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --set-secrets "OPENAI_API_KEY=OPENAI_API_KEY:latest,DB_HOST=DB_HOST:latest,DB_USER=DB_USER:latest,DB_PASSWORD=DB_PASSWORD:latest"
```

Cloud Run собирает образ из `Dockerfile`, пушит в Artifact Registry и деплоит. Порт 8080 (стандартный для Cloud Run, задан в Dockerfile). Секреты из Secret Manager прокидываются как переменные окружения.

### Локальная проверка Docker-образа

```bash
docker build -t kus-conjugator-2.0 .
docker run --rm -p 8080:8080 --env-file .env kus-conjugator-2.0
```

Приложение будет доступно на http://localhost:8080.

---

## Структура проекта

```
kus_conj2/
├── .env                  # Переменные окружения (не в git)
├── .env.example          # Шаблон .env
├── .dockerignore         # Исключения для Docker-сборки
├── Dockerfile            # Multi-stage build для Cloud Run
├── README.md             # Этот файл
├── docs/
│   ├── CHANGELOG.md          # История изменений
│   ├── TZ-specification.md   # Техническое задание
│   └── DB-SCHEMA.md          # Схема базы данных
├── backend/
│   ├── requirements.txt
│   └── app/
│       ├── main.py       # FastAPI-приложение, CORS, health-check, раздача статики
│       ├── db.py         # Подключение к PostgreSQL
│       ├── schemas.py    # Pydantic-модели ответов
│       └── routes/
│           └── api.py    # Эндпоинты API
└── frontend/
    ├── index.html
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts    # Vite + proxy /api → localhost:8000
    └── src/
        ├── main.tsx      # Точка входа React
        ├── App.tsx       # Основной компонент приложения
        └── style.css     # Стили
```

## Использование

1. Выберите фильтры: наклонение, время, категорию и тип глагола.
2. Переходите по глаголам кнопками «Предыдущий» / «Следующий».
3. Введите формы спряжения по лицам и нажмите «Проверить».
4. Неправильные ответы подсвечиваются с подсказкой правильной формы.
5. Нажмите «Повторить» для сброса и повторной тренировки.
