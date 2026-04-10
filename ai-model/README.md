# AI Model — Gesture Classification

This directory contains the gesture classification pipeline for Rock-Paper-Scissors.

## Architecture

```
ai-model/
├── training/        # Training scripts & notebooks
│   └── train.js     # TensorFlow.js model training script
├── model/           # Exported model files (.json + .bin)
│   └── model.json   # TF.js model topology (after training)
├── data/            # Training dataset (landmarks)
│   └── gestures.csv # Collected hand landmark data
└── README.md        # This file
```

## Pipeline

1. **Data Collection** → MediaPipe Hands extracts 21 landmarks (63 features) per frame
2. **Training** → Simple dense neural network classifies landmarks → gesture
3. **Export** → Model exported as TF.js LayersModel for browser inference
4. **Inference** → Runs client-side at <10ms per prediction

## Model Details

- **Input**: 63 features (21 landmarks × 3 coordinates: x, y, z)
- **Output**: 4 classes — Rock, Paper, Scissors, None
- **Architecture**: Dense(128) → Dropout(0.3) → Dense(64) → Dense(4, softmax)
- **Size**: ~50KB (optimized for browser)

> This will be fully implemented in Phase 3.
