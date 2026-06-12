#!/usr/bin/env node
/**
 * ML Delay Prediction Model Trainer
 *
 * Trains a linear regression model on historical Indian Railway delay data.
 * Features: weather (one-hot), month (one-hot), train ID (one-hot), route length.
 * Exports: ONNX model file + JSON weights for browser inference.
 *
 * Run: node scripts/train-delay-model.mjs
 */

import fs from 'fs';
import path from 'path';

const DATA_PATH = path.resolve('data/historical_delays.json');
const ONNX_OUTPUT = path.resolve('public/data/delay-model.onnx');
const WEIGHTS_OUTPUT = path.resolve('public/data/delay-model-weights.json');

// ─── Feature Encoding ──────────────────────────────────────────────────────

const WEATHER_TYPES = ['Clear', 'Rain', 'Heavy Rain', 'Fog', 'Heavy Fog', 'Monsoon', 'Heatwave'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const TRAIN_TYPES = ['rajdhani', 'express', 'mail', 'passenger'];

// Map train numbers to types (from corridor.ts)
const TRAIN_TYPE_MAP = {
  '12301': 'rajdhani', '12303': 'express', '12305': 'rajdhani', '13005': 'mail',
  '12273': 'express', '12002': 'rajdhani', '12951': 'rajdhani', '12259': 'express',
  '12434': 'mail', '12809': 'express', '12625': 'mail', '12137': 'express',
  '12559': 'mail', '12367': 'express', '12903': 'rajdhani', '12267': 'express',
  '12050': 'rajdhani', '12215': 'express', '12165': 'express', '12723': 'mail',
  '12229': 'express', '12426': 'mail', '12826': 'express', '12101': 'rajdhani',
  '12611': 'mail', '12433': 'express', '12877': 'express', '12269': 'express',
};

const FEATURE_NAMES = [
  ...WEATHER_TYPES.map(w => `weather_${w}`),
  ...MONTHS.map(m => `month_${m}`),
  ...TRAIN_TYPES.map(t => `trainType_${t}`),
  'route_length_km',
  'is_night',       // hours 20-6 = night (fog season proxy)
  'is_monsoon',     // Jun-Sep
  'is_winter',      // Nov-Feb (fog season)
];

const NUM_FEATURES = FEATURE_NAMES.length; // 7 + 12 + 4 + 1 + 3 = 27

function encodeWeather(weather) {
  const vec = new Array(WEATHER_TYPES.length).fill(0);
  const idx = WEATHER_TYPES.indexOf(weather);
  if (idx >= 0) vec[idx] = 1;
  return vec;
}

function encodeMonth(month) {
  const vec = new Array(MONTHS.length).fill(0);
  const idx = MONTHS.indexOf(month);
  if (idx >= 0) vec[idx] = 1;
  return vec;
}

function encodeTrainType(trainNo) {
  const vec = new Array(TRAIN_TYPES.length).fill(0);
  const type = TRAIN_TYPE_MAP[trainNo] || 'express';
  const idx = TRAIN_TYPES.indexOf(type);
  if (idx >= 0) vec[idx] = 1;
  return vec;
}

function normalizeRouteKm(km) {
  return km / 1500;
}

function encodeSample(record, routeKm = 765) {
  const monthIdx = MONTHS.indexOf(record.month);
  const isWinter = monthIdx >= 0 && (monthIdx <= 1 || monthIdx >= 10); // Nov-Feb
  const isMonsoon = monthIdx >= 0 && monthIdx >= 5 && monthIdx <= 8; // Jun-Sep

  return [
    ...encodeWeather(record.weather),
    ...encodeMonth(record.month),
    ...encodeTrainType(record.trainNo),
    normalizeRouteKm(routeKm),
    0, // is_night (not available in data, use 0)
    isMonsoon ? 1 : 0,
    isWinter ? 1 : 0,
  ];
}

// ─── Linear Algebra ────────────────────────────────────────────────────────

/** Multiply matrices A (m×n) × B (n×p) → result (m×p) */
function matMul(A, B) {
  const m = A.length, n = A[0].length, p = B[0].length;
  const result = Array.from({ length: m }, () => new Array(p).fill(0));
  for (let i = 0; i < m; i++)
    for (let k = 0; k < n; k++)
      for (let j = 0; j < p; j++)
        result[i][j] += A[i][k] * B[k][j];
  return result;
}

/** Transpose matrix A (m×n) → A^T (n×m) */
function transpose(A) {
  const m = A.length, n = A[0].length;
  return Array.from({ length: n }, (_, j) => Array.from({ length: m }, (_, i) => A[i][j]));
}

/** Add bias column of 1s to feature matrix */
function addBias(X) {
  return X.map(row => [1, ...row]);
}

/** Solve ridge regression: w = (X^T X + λI)^{-1} X^T y using Gaussian elimination */
function solveRidgeRegression(X, y, lambda = 1.0) {
  const Xt = transpose(X);
  const XtX = matMul(Xt, X);
  const Xty = matMul(Xt, y.map(v => [v]));

  const n = XtX.length;
  // Add L2 regularization: XtX + λI (skip bias at index 0)
  for (let i = 1; i < n; i++) {
    XtX[i][i] += lambda;
  }

  // Augmented matrix [XtX | Xty]
  const aug = XtX.map((row, i) => [...row, Xty[i][0]]);

  // Gaussian elimination with partial pivoting
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    let maxVal = Math.abs(aug[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > maxVal) {
        maxVal = Math.abs(aug[row][col]);
        maxRow = row;
      }
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-12) continue;
    for (let row = col + 1; row < n; row++) {
      const factor = aug[row][col] / pivot;
      for (let j = col; j <= n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  const w = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = aug[i][n];
    for (let j = i + 1; j < n; j++) {
      sum -= aug[i][j] * w[j];
    }
    w[i] = aug[i][i] !== 0 ? sum / aug[i][i] : 0;
  }

  return w;
}

// ─── Training ──────────────────────────────────────────────────────────────

console.log('Loading historical delay data...');
const rawData = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
console.log(`Loaded ${rawData.length} records for ${new Set(rawData.map(r => r.trainNo)).size} trains`);

// Default route length for each train (approximate Delhi-Howrah segments)
const TRAIN_ROUTE_KM = {
  '12301': 1531, '12303': 1200, '12305': 1100, '13005': 1531,
  '12273': 1531, '12002': 1400, '12951': 1531, '12259': 1531,
  '12434': 1300, '12809': 1200, '12625': 1400, '12137': 800,
  '12559': 1531, '12367': 1100, '12903': 1531, '12267': 1531,
  '12050': 1531, '12215': 1531, '12165': 1531, '12723': 1531,
  '12229': 1531, '12426': 1531, '12826': 1531, '12101': 1531,
  '12611': 1531, '12433': 1531, '12877': 1531, '12269': 1531,
};

// Encode all samples
const X_raw = rawData.map(r => encodeSample(r, TRAIN_ROUTE_KM[r.trainNo] || 765));
const y = rawData.map(r => r.avgDelay);

// Add bias column
const X = addBias(X_raw);

console.log(`Feature matrix: ${X.length} samples × ${X[0].length} features (including bias)`);
console.log(`Training ridge regression (λ=1.0) via normal equation...`);

const weights = solveRidgeRegression(X, y, 1.0);

const bias = weights[0];
const featureWeights = weights.slice(1);

// ─── Evaluate ──────────────────────────────────────────────────────────────

let sumSquaredError = 0;
let sumAbsoluteError = 0;
let maxError = 0;

rawData.forEach((record, i) => {
  const x = [1, ...X_raw[i]];
  let pred = 0;
  for (let j = 0; j < weights.length; j++) pred += x[j] * weights[j];
  pred = Math.max(0, pred); // delay can't be negative

  const error = pred - record.avgDelay;
  sumSquaredError += error * error;
  sumAbsoluteError += Math.abs(error);
  maxError = Math.max(maxError, Math.abs(error));
});

const mse = sumSquaredError / rawData.length;
const rmse = Math.sqrt(mse);
const mae = sumAbsoluteError / rawData.length;
const r2 = 1 - (sumSquaredError / rawData.reduce((sum, r) => {
  const mean = y.reduce((a, b) => a + b, 0) / y.length;
  return sum + (r.avgDelay - mean) ** 2;
}, 0));

console.log('\n─── Model Evaluation ───');
console.log(`RMSE: ${rmse.toFixed(2)} minutes`);
console.log(`MAE:  ${mae.toFixed(2)} minutes`);
console.log(`Max Error: ${maxError.toFixed(2)} minutes`);
console.log(`R² Score:  ${r2.toFixed(4)}`);

// ─── Export Weights JSON ───────────────────────────────────────────────────

const weightsJson = {
  version: '1.0.0',
  model: 'LinearRegression',
  trainedAt: new Date().toISOString(),
  trainingSamples: rawData.length,
  numFeatures: NUM_FEATURES,
  featureNames: FEATURE_NAMES,
  metrics: { rmse: +rmse.toFixed(4), mae: +mae.toFixed(4), r2: +r2.toFixed(4), maxError: +maxError.toFixed(4) },
  bias,
  weights: featureWeights,
  encoders: {
    weather: WEATHER_TYPES,
    months: MONTHS,
    trainTypes: TRAIN_TYPES,
    trainTypeMap: TRAIN_TYPE_MAP,
  }
};

fs.mkdirSync(path.dirname(WEIGHTS_OUTPUT), { recursive: true });
fs.writeFileSync(WEIGHTS_OUTPUT, JSON.stringify(weightsJson, null, 2));
console.log(`\nWeights saved to ${WEIGHTS_OUTPUT}`);

// ─── Export ONNX Model ─────────────────────────────────────────────────────

function buildOnnxModel(bias, weights) {
  const numFeatures = weights.length;

  // Build weight tensor as float32 array [1, numFeatures]
  const weightData = new Float32Array(weights);
  const biasData = new Float32Array([bias]);

  // Minimal protobuf encoder for ONNX
  function encodeVarint(value) {
    const bytes = [];
    while (value > 0x7f) {
      bytes.push((value & 0x7f) | 0x80);
      value >>>= 7;
    }
    bytes.push(value & 0x7f);
    return new Uint8Array(bytes);
  }

  function encodeFloat32(value) {
    const buf = new ArrayBuffer(4);
    new Float32Array(buf)[0] = value;
    return new Uint8Array(buf);
  }

  function encodeProtoField(fieldNum, wireType, data) {
    const tag = (fieldNum << 3) | wireType;
    return [...encodeVarint(tag), ...data];
  }

  function encodeLengthDelimited(fieldNum, data) {
    return encodeProtoField(fieldNum, 2, [...encodeVarint(data.length), ...data]);
  }

  function encodeVarintField(fieldNum, value) {
    return encodeProtoField(fieldNum, 0, encodeVarint(value));
  }

  function encodeBytes(fieldNum, bytes) {
    return encodeLengthDelimited(fieldNum, [...bytes]);
  }

  function encodeString(fieldNum, str) {
    return encodeLengthDelimited(fieldNum, [...new TextEncoder().encode(str)]);
  }

  function encodeMessage(fieldNum, msgBytes) {
    return encodeLengthDelimited(fieldNum, msgBytes);
  }

  function concat(...arrays) {
    return arrays.flat();
  }

  // ── TensorProto for weights [1, numFeatures] ──
  function buildTensorProto(data, dims) {
    return concat(
      encodeVarintField(1, 1), // FLOAT type
      encodeVarintField(13, 0), // UNDEFINED data_location
      ...dims.map((d) => encodeVarintField(6, d)), // dims (repeated)
      encodeBytes(7, data), // raw_data
    );
  }

  // ── TypeProto for [1, numFeatures] ──
  function buildTensorTypeProto(numFeatures) {
    return concat(
      encodeVarintField(1, 1), // FLOAT
      encodeMessage(4, concat(
        encodeVarintField(1, 1), // dim: 1 (denotation: BATCH)
        encodeVarintField(2, 1), // dim_value: 1
      )),
      encodeMessage(4, concat(
        encodeVarintField(1, 2), // dim: 2 (denotation: DATA_AXIS)
        encodeVarintField(2, numFeatures), // dim_value: numFeatures
      )),
    );
  }

  // ── ValueInfoProto for input X ──
  const inputX = concat(
    encodeString(1, 'X'),
    encodeMessage(2, buildTensorTypeProto(numFeatures)),
  );

  // ── ValueInfoProto for output Y ──
  const outputY = concat(
    encodeString(1, 'Y'),
    encodeMessage(2, concat(
      encodeVarintField(1, 1), // FLOAT
      encodeMessage(4, concat(
        encodeVarintField(1, 1),
        encodeVarintField(2, 1),
      )),
      encodeMessage(4, concat(
        encodeVarintField(1, 2),
        encodeVarintField(2, 1),
      )),
    )),
  );

  // ── NodeProto: Gemm (Y = X * W^T + bias) ──
  const gemmNode = concat(
    encodeString(1, 'gemm'), // op_type
    encodeString(2, 'Gemm'), // name
    ...['X', 'W', 'B'].map((n, i) => encodeString(7 + i, n)), // inputs
    encodeString(10, 'Y'), // output
    // Attribute: alpha = 1.0
    encodeMessage(5, concat(
      encodeString(1, 'alpha'),
      encodeVarintField(2, 1), // FLOAT type
      encodeBytes(3, encodeFloat32(1.0)),
    )),
    // Attribute: beta = 1.0
    encodeMessage(5, concat(
      encodeString(1, 'beta'),
      encodeVarintField(2, 1),
      encodeBytes(3, encodeFloat32(1.0)),
    )),
    // Attribute: transB = 1 (transpose weight matrix)
    encodeMessage(5, concat(
      encodeString(1, 'transB'),
      encodeVarintField(2, 2), // INT type
      encodeBytes(4, encodeVarint(1)),
    )),
  );

  // ── GraphProto ──
  const graph = concat(
    encodeString(1, 'delay-prediction'),
    // Initializers: W and B
    encodeMessage(11, buildTensorProto(weightData, [1, numFeatures])), // W
    encodeMessage(11, buildTensorProto(biasData, [1])), // B
    // inputs
    encodeMessage(11, inputX),
    // outputs
    encodeMessage(12, outputY),
    // nodes
    encodeMessage(7, gemmNode),
  );

  // ── ModelProto ──
  const model = concat(
    encodeVarintField(1, 3), // ir_version = 3
    encodeVarintField(7, 0), // OperatorSetId ai.onnx = 0
    encodeString(4, 'RailTwin Delay Prediction'),
    encodeString(5, 'Linear regression model for Indian Railway delay prediction'),
    encodeMessage(7, graph),
  );

  return new Uint8Array(model);
}

const onnxBytes = buildOnnxModel(bias, featureWeights);
fs.mkdirSync(path.dirname(ONNX_OUTPUT), { recursive: true });
fs.writeFileSync(ONNX_OUTPUT, onnxBytes);
console.log(`ONNX model saved to ${ONNX_OUTPUT} (${(onnxBytes.length / 1024).toFixed(1)} KB)`);

console.log('\n─── Training Complete ───');
console.log(`Features: ${NUM_FEATURES} (${WEATHER_TYPES.length} weather + ${MONTHS.length} months + ${TRAIN_TYPES.length} trainTypes + 1 route + 3 derived)`);
console.log(`Bias: ${bias.toFixed(4)}`);
