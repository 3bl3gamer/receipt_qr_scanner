# Receipt QR scanner

Брауерный сканер и серверный загрузчик данных с чека по QR-коду.
Предназначен для запуска на своём домашнем сервере (авторизации нет, разграничения доступа нет).

Сканер сделан на [cozmo/jsQR](https://github.com/cozmo/jsQR), но с использованием не совсем публичного её АПИ.
Благодаря этому поверх видео с камеры рисуются найденные сканером ключевые точки
(т.е. есть хоть какая-то индикация того, что сканер вообще работает).

Загрузка чековых данных сделана по [habr.com/ru/post/358966/](https://habr.com/ru/post/358966/).

## Запуск

### Дев-режим
```bash
go build -v
./receipt_qr_scanner -env=dev
```

### Прод-режим
```bash
go build -v
cd www
npm install
npm run build
cd -
./receipt_qr_scanner -env=prod
```

Аргументом `-addr` можно задать адрес сервера, по умолчанию — `127.0.0.1:9010`. В дев-режиме на следующим за сервером порту запускается сервер Роллапа.