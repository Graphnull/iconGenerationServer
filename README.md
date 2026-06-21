# Icon Generation Server

Express-сервер для генерации иконок с использованием Ollama AI. Поддерживает кеширование результатов и окрашивание иконок в произвольный цвет.

## Возможности

- 🎨 Генерация иконок через Ollama (модель x/flux2-klein:4b)
- 🗄️ Кеширование по MD5 хешу `prompt:color`
- 🎨 Окрашивание иконок в любой hex-цвет
- ✂️ Автоматическая обрезка и ресайз до 256x256
- 🔍 Greyscale + contrast для чётких контуров

## Требования

- Node.js 18+
- Ollama с установленной моделью `x/flux2-klein:4b`

```bash
# Установка Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Загрузка модели
ollama pull x/flux2-klein:4b
```

## Установка

```bash
npm install
```

## Запуск

```bash
# Режим разработки (с hot-reload)
npm run dev

# Продакшен
npm run build
npm start
```

Или через PM2:

```bash
pm2 start ecosystem.config.js
```

Сервер запустится на порту 3000 (изменить: `PORT=8080 npm start`).

## API Endpoints

### POST /icon

Генерация иконки.

**Request:**
```json
{
  "prompt": "robot-head",
  "color": "#FF5733"
}
```

| Параметр | Тип   | Описание                          |
|----------|-------|-----------------------------------|
| prompt   | string | Текстовый промпт для генерации   |
| color    | string | Hex-цвет (#RRGGBB или RRGGBB)    |

**Response (200):**
```json
{
  "success": true,
  "cacheKey": "a1b2c3d4e5f6...",
  "image": "data:image/png;base64,iVBORw0..."
}
```

**Response (400):**
```json
{
  "error": "Missing required fields: prompt and color are required"
}
```

### GET /health

Проверка работоспособности.

```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-06-21T13:30:00.000Z"
}
```

### GET /icons

Список кешированных иконок.

```bash
curl http://localhost:3000/icons
```

**Response:**
```json
{
  "count": 5,
  "files": ["a1b2c3d4.png", "e5f6g7h8.png", ...]
}
```

## Примеры использования

### curl

```bash
# Красная иконка робота
curl -X POST http://localhost:3000/icon \
  -H "Content-Type: application/json" \
  -d '{"prompt": "robot-head", "color": "#FF0000"}'

# Синяя иконка звезды
curl -X POST http://localhost:3000/icon \
  -H "Content-Type: application/json" \
  -d '{"prompt": "star", "color": "3498db"}'

# Зелёная иконка черепахи
curl -X POST http://localhost:3000/icon \
  -H "Content-Type: application/json" \
  -d '{"prompt": "turtle", "color": "#27ae60"}'
```

### JavaScript / Fetch

```javascript
const response = await fetch('http://localhost:3000/icon', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'robot-head',
    color: '#FF5733'
  })
});

const { success, cacheKey, image } = await response.json();

// Показать иконку в <img>
document.querySelector('img').src = image;
```

### Python

```python
import requests
import base64

response = requests.post('http://localhost:3000/icon', json={
    'prompt': 'robot-head',
    'color': '#FF5733'
})

data = response.json()
if data['success']:
    # Декодировать base64 и сохранить
    img_data = base64.b64decode(data['image'].split(',')[1])
    with open('icon.png', 'wb') as f:
        f.write(img_data)
```

## Примеры сгенерированных иконок

### robot-head (#FF5733)
![Robot Head](icons/example-robot-head.png)

### star (#3498db)
![Star](icons/example-star.png)

### turtle (#27ae60)
![Turtle](icons/example-turtle.png)

## Структура проекта

```
iconGenerationServer/
├── src/
│   ├── server.ts        # Express сервер
│   ├── processImage.ts  # Обработка изображений
│   └── const.ts         # Константы
├── icons/               # Кеш иконок (PNG)
├── dist/                # Скомпилированный JS
├── ecosystem.config.js  # PM2 конфигурация
├── package.json
└── tsconfig.json
```

## Как работает

1. **Проверка кеша** — запрос проверяется по MD5(prompt:color)
2. **Генерация** — при cache miss вызывается Ollama:
   ```
   ollama run x/flux2-klein:4b '{"icon":true,"style":"minimalistic","info":"<prompt>"}'
   ```
3. **Обработка** — greyscale → contrast → crop → resize 256x256
4. **Окрашивание** — blend по luminance (тёмные области окрашиваются сильнее)
5. **Кеширование** — сохранение в icons/{cacheKey}.png

## Лицензия

Apache License 2.0