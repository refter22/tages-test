const fs = require('fs')
const readline = require('readline')

const INPUT_FILE = 'input.txt'
const OUTPUT_FILE = 'output.txt'
const CHUNK_SIZE = 10 * 1024 * 1024 // 10 МБ

async function sortLargeFile() {
  const chunkFiles = await splitAndSortChunks()
  await mergeChunks(chunkFiles)
  cleanupChunks(chunkFiles)
}

async function splitAndSortChunks() {
  const chunkFiles = [];
  let chunkNumber = 0;
  let currentSize = 0;
  let writeStream = fs.createWriteStream(`chunk_${chunkNumber}.txt`);

  const fileStream = fs.createReadStream(INPUT_FILE);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let linesRead = 0;

  for await (const line of rl) {
    writeStream.write(line + '\n');
    currentSize += Buffer.byteLength(line, 'utf8') + 1;
    linesRead++;

    if (currentSize >= CHUNK_SIZE) {
      await new Promise(resolve => writeStream.end(resolve));
      await sortChunk(`chunk_${chunkNumber}.txt`);
      chunkFiles.push(`chunk_${chunkNumber}.txt`);
      chunkNumber++;
      currentSize = 0;
      writeStream = fs.createWriteStream(`chunk_${chunkNumber}.txt`);
    }
  }

  if (currentSize > 0) {
    await new Promise(resolve => writeStream.end(resolve));
    await sortChunk(`chunk_${chunkNumber}.txt`);
    chunkFiles.push(`chunk_${chunkNumber}.txt`);
  }

  console.log(`Прочитано строк: ${linesRead}`);
  console.log(`Создано чанков: ${chunkFiles.length}`);

  return chunkFiles;
}

async function sortChunk(filePath) {
  const content = await fs.promises.readFile(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim() !== '');
  lines.sort((a, b) => a.localeCompare(b));
  await fs.promises.writeFile(filePath, lines.join('\n'));
  console.log(`Отсортирован чанк: ${filePath}, строк: ${lines.length}`);
}

async function mergeChunks(chunkFiles) {
  const outputStream = fs.createWriteStream(OUTPUT_FILE, { highWaterMark: 1024 * 1024 });
  const readers = chunkFiles.map(() => null);
  const heap = new MinHeap(chunkFiles.length);

  for (let i = 0; i < chunkFiles.length; i++) {
    const line = await getNextLine(i, chunkFiles, readers);
    if (line !== null) {
      heap.insert(line, i);
    }
  }

  console.log(`Инициализирована куча размером: ${heap.size}`);

  let outputBuffer = '';
  const flushBuffer = () => {
    if (outputBuffer.length > 0) {
      outputStream.write(outputBuffer);
      outputBuffer = '';
    }
  };

  let linesWritten = 0;
  let lastLine = '';

  while (heap.size > 0) {
    const { value: minLine, readerIndex } = heap.extractMin();

    if (minLine !== lastLine) {
      outputBuffer += minLine + '\n';
      linesWritten++;
      lastLine = minLine;
    }

    if (outputBuffer.length >= 1024 * 1024) {
      flushBuffer();
    }

    const nextLine = await getNextLine(readerIndex, chunkFiles, readers);
    if (nextLine !== null) {
      heap.insert(nextLine, readerIndex);
    }
  }

  if (outputBuffer.endsWith('\n')) {
    outputBuffer = outputBuffer.slice(0, -1);
  }
  flushBuffer();
  outputStream.end();

  console.log(`Записано строк: ${linesWritten}`);

  await new Promise((resolve) => outputStream.on('finish', resolve));

  for (const reader of readers) {
    if (reader) {
      reader.close();
    }
  }
}

async function getNextLine(index, chunkFiles, readers) {
  if (!readers[index]) {
    readers[index] = await openChunkReader(chunkFiles[index]);
  }

  const { value, done } = await readers[index].next();

  if (done) {
    readers[index].close();
    readers[index] = null;
    return null;
  }

  return value;
}

async function openChunkReader(filePath) {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  const iterator = rl[Symbol.asyncIterator]();
  return {
    next: () => iterator.next(),
    close: () => {
      rl.close();
      fileStream.close();
    }
  };
}

function cleanupChunks(chunkFiles) {
  chunkFiles.forEach((file) => fs.unlinkSync(file))
}

class MinHeap {
  constructor(capacity) {
    this.capacity = capacity;
    this.size = 0;
    this.heap = new Array(capacity * 2);
  }

  insert(value, readerIndex) {
    if (this.size >= this.capacity) {
      throw new Error('Heap is full');
    }
    let i = this.size;
    this.heap[i * 2] = value;
    this.heap[i * 2 + 1] = readerIndex;
    this.size++;
    this.bubbleUp(i);
  }

  extractMin() {
    if (this.size === 0) return null;
    const minValue = this.heap[0];
    const minReaderIndex = this.heap[1];
    this.size--;
    if (this.size > 0) {
      this.heap[0] = this.heap[this.size * 2];
      this.heap[1] = this.heap[this.size * 2 + 1];
      this.bubbleDown(0);
    }
    return { value: minValue, readerIndex: minReaderIndex };
  }

  bubbleUp(i) {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.heap[parent * 2].localeCompare(this.heap[i * 2]) <= 0) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  bubbleDown(i) {
    while (true) {
      let minIndex = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < this.size && this.heap[left * 2].localeCompare(this.heap[minIndex * 2]) < 0) {
        minIndex = left;
      }
      if (right < this.size && this.heap[right * 2].localeCompare(this.heap[minIndex * 2]) < 0) {
        minIndex = right;
      }
      if (minIndex === i) break;
      this.swap(i, minIndex);
      i = minIndex;
    }
  }

  swap(i, j) {
    [this.heap[i * 2], this.heap[j * 2]] = [this.heap[j * 2], this.heap[i * 2]];
    [this.heap[i * 2 + 1], this.heap[j * 2 + 1]] = [this.heap[j * 2 + 1], this.heap[i * 2 + 1]];
  }
}

sortLargeFile().catch(console.error)