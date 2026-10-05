# opencode-deepseek bridge

Этот каталог содержит только подготовку удалённого DeepSeek Web bridge для провайдера
`opencode_deepseek` в `my-agent`.

## Архитектура

`my-agent` → Supabase Edge Function `opencode-deepseek` → HTTPS DeepSeek bridge → `chat.deepseek.com`

Supabase function уже создана и ожидает:

- `OPENCODE_DEEPSEEK_URL` — HTTPS URL удалённого OpenAI-compatible bridge.
- `OPENCODE_DEEPSEEK_PROXY_KEY` — необязательный ключ самого bridge.

Секреты DeepSeek в репозиторий не добавляются.

## Рекомендуемый bridge

Используется внешний проект:

https://github.com/dasepmoch/Deepseek-API-Bridge

Он предоставляет OpenAI-compatible `/v1/chat/completions`, `/v1/models` и `/healthz`, а также tool calling и streaming.

## Что осталось после этой подготовки

1. Запустить bridge на машине/VPS/Codespace с постоянным HTTPS-доступом.
2. Один раз авторизовать в bridge собственный аккаунт DeepSeek Web.
3. Получить публичный HTTPS endpoint bridge.
4. Записать его в Supabase Secret `OPENCODE_DEEPSEEK_URL`.
5. Если включён proxy key — записать его в `OPENCODE_DEEPSEEK_PROXY_KEY`.

Ни токен DeepSeek, ни cookies, ни session-файлы не должны попадать в GitHub или чат.

## Важно

Supabase Edge Function не является самим DeepSeek bridge. Она выступает защищённым gateway между браузером агента и удалённым bridge.

Локальный адрес вроде `127.0.0.1:8090` здесь не подходит: его увидит только устройство, на котором запущен bridge.
