# Сортировка большого файла

Этот проект представляет собой решение для сортировки очень больших текстовых файлов, которые не помещаются в оперативную память.

## Описание

Проект состоит из двух основных частей:

1. Генератор большого файла (`largeFileGenerator.js`)
2. Сортировщик большого файла (`largeFileSorter.js`)

### Генератор большого файла

Скрипт `largeFileGenerator.js` создает большой текстовый файл с случайными строками для тестирования сортировщика.

### Сортировщик большого файла

Скрипт `largeFileSorter.js` реализует алгоритм внешней сортировки для обработки больших файлов. Он работает следующим образом:

1. Разделяет входной файл на отсортированные чанки
2. Сортирует каждый чанк отдельно
3. Выполняет слияние отсортированных чанков в выходной файл

## Использование

1. Сгенерируйте тестовый файл:

```
node largeFileGenerator.js --output input.txt --fileSize 100 --chunkSize 10
```

2. Запустите сортировку:

```
node largeFileSorter.js --input input.txt --output output.txt --chunkSize 10
```
