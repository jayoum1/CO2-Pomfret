# Next Steps & Setup Guide

## 📦 Step 1: Install Required Packages

### Option A: Using pip (Recommended)
```bash
cd "/Users/jay/Desktop/CO2 Pomfret"
pip install -r requirements.txt
```

### Option B: Using conda (if you prefer conda)
```bash
cd "/Users/jay/Desktop/CO2 Pomfret"
conda install pandas numpy scikit-learn scipy statsmodels matplotlib
```

### Option C: Install individually
```bash
pip install pandas numpy scikit-learn scipy statsmodels matplotlib
```

### Verify Installation
```bash
python3 -c "import pandas, numpy, sklearn, scipy, statsmodels, matplotlib; print('✓ All packages installed successfully')"
```

---

## 🔍 Step 2: Verify Data Files

After installing packages, run this check:

```bash
python3 -c "
import pandas as pd
from pathlib import Path

# Check all data files
files_to_check = [
    'Data/Raw Data/CO2 Pomfret Raw Data - Upper.csv',
    'Data/Raw Data/CO2 Pomfret Raw Data - Middle.csv',
    'Data/Raw Data/CO2 Pomfret Raw Data - Lower.csv',
    'Data/Processed Data/DBH/lower_long_with_growth.csv',
    'Data/Processed Data/Carbon/upper_with_carbon.csv',
    'Data/Processed Data/Carbon/middle_with_carbon.csv',
    'Data/Processed Data/Carbon/lower_with_carbon.csv',
    'Data/Processed Data/Carbon/all_plots_with_carbon.csv',
    'Data/Processed Data/Carbon/all_plots_with_carbon_encoded.csv',
]

for file_path in files_to_check:
    path = Path(file_path)
    if path.exists():
        df = pd.read_csv(path)
        print(f'✓ {path.name}: {df.shape[0]} rows × {df.shape[1]} cols')
    else:
        print(f'✗ {path.name}: NOT FOUND')
"
```

---

## 🧪 Step 3: Test Script Execution

### Test 1: Species Classification (No data loading required)
```bash
python3 -c "
import sys
sys.path.insert(0, 'src')
from forestry.species_classifier import classify_group

# Test the function
print('Testing species classification:')
print(f'  red oak → {classify_group(\"red oak\")}')
print(f'  white pine → {classify_group(\"white pine\")}')
print(f'  maple → {classify_group(\"maple\")}')
print('✓ Species classification works!')
"
```

### Test 2: Run Preprocessing Pipeline (if data needs reprocessing)
```bash
# Step 1: Transform raw data to long format
python3 src/preprocessing/transform.py

# Step 2: Add carbon calculations
python3 src/preprocessing/carbon_calc.py

# Step 3: Standardize species names
python3 src/preprocessing/species.py

# Step 4: Add CarbonGrowth column
python3 src/preprocessing/growth.py

# Step 5: Handle outliers (if needed)
python3 src/preprocessing/outliers.py

# Step 6: One-hot encode for modeling
python3 src/preprocessing/encoding.py
```

### Test 3: Run Analysis
```bash
# Run linear regression modeling
python3 src/analysis/modeling.py
```

### Test 4: Generate Visualizations
```bash
# Generate EDA plots
python3 src/visualization/eda.py

# Generate modeling diagnostic plots
python3 src/visualization/modeling.py
```

---

## 🔎 Step 4: Data Quality Checks

After installing packages, run this comprehensive data check:

```python
# Save as: check_data_quality.py
import pandas as pd
from pathlib import Path

def check_data_quality():
    """Comprehensive data quality check."""
    
    # Check 1: Row counts match
    print("1. Checking row counts...")
    upper = pd.read_csv("Data/Processed Data/Carbon/upper_with_carbon.csv")
    middle = pd.read_csv("Data/Processed Data/Carbon/middle_with_carbon.csv")
    lower = pd.read_csv("Data/Processed Data/Carbon/lower_with_carbon.csv")
    all_plots = pd.read_csv("Data/Processed Data/Carbon/all_plots_with_carbon.csv")
    
    total_individual = len(upper) + len(middle) + len(lower)
    if total_individual == len(all_plots):
        print(f"   ✓ Row counts match: {total_individual} rows")
    else:
        print(f"   ⚠ Mismatch: Individual={total_individual}, Combined={len(all_plots)}")
    
    # Check 2: Required columns present
    print("\n2. Checking required columns...")
    required = ['Plot', 'TreeID', 'Species', 'Year', 'DBH', 'Carbon']
    missing = [col for col in required if col not in all_plots.columns]
    if not missing:
        print(f"   ✓ All required columns present")
    else:
        print(f"   ⚠ Missing columns: {missing}")
    
    # Check 3: No duplicate TreeID-Year-Plot combinations
    print("\n3. Checking for duplicates...")
    duplicates = all_plots.duplicated(subset=['TreeID', 'Year', 'Plot'], keep=False)
    if not duplicates.any():
        print(f"   ✓ No duplicate TreeID-Year-Plot combinations")
    else:
        print(f"   ⚠ Found {duplicates.sum()} duplicates")
    
    # Check 4: Carbon values are reasonable
    print("\n4. Checking Carbon values...")
    carbon = all_plots['Carbon']
    print(f"   Min: {carbon.min():.2f}")
    print(f"   Max: {carbon.max():.2f}")
    print(f"   Mean: {carbon.mean():.2f}")
    print(f"   NaN count: {carbon.isna().sum()}")
    
    # Check 5: Encoded file matches original
    print("\n5. Checking encoded file...")
    encoded = pd.read_csv("Data/Processed Data/Carbon/all_plots_with_carbon_encoded.csv")
    if len(encoded) == len(all_plots):
        print(f"   ✓ Encoded file has {len(encoded)} rows (matches original)")
        print(f"   ✓ Encoded file has {encoded.shape[1]} columns (expanded from {all_plots.shape[1]})")
    else:
        print(f"   ⚠ Row count mismatch")
    
    print("\n" + "="*60)
    print("Data quality check complete!")

if __name__ == "__main__":
    check_data_quality()
```

Run with:
```bash
python3 check_data_quality.py
```

---

## 📋 Step 5: Known Issues to Check

### Missing Processed Files
Based on the file structure, you may be missing:
- `Data/Processed Data/DBH/upper_long_with_growth.csv`
- `Data/Processed Data/DBH/middle_long_with_growth.csv`

**Solution:** Run `src/preprocessing/transform.py` to generate these files.

### Data Consistency
Check that:
1. All plots are represented in `all_plots_with_carbon.csv`
2. Row counts match sum of individual plot files
3. No duplicate TreeID-Year-Plot combinations
4. Carbon values are reasonable (not negative, not extremely large)

---

## 🚀 Step 6: Recommended Workflow

### For First-Time Setup:
1. ✅ Install packages: `pip install -r requirements.txt`
2. ✅ Verify installation: Test species classification
3. ✅ Check data files: Run data quality check
4. ✅ Run preprocessing pipeline: Generate all processed files
5. ✅ Run analysis: Execute modeling script
6. ✅ Generate visualizations: Create plots

### For Regular Use:
1. Load processed data: `all_plots_with_carbon_encoded.csv`
2. Run analysis: `src/analysis/modeling.py`
3. Generate new visualizations: `src/visualization/eda.py`

---

## 🐛 Troubleshooting

### Import Errors
If you get `ModuleNotFoundError`:
```bash
# Make sure you're in the project root
cd "/Users/jay/Desktop/CO2 Pomfret"

# Verify Python can find src/
python3 -c "import sys; sys.path.insert(0, 'src'); from config import PROJECT_ROOT; print(PROJECT_ROOT)"
```

### Path Issues
If scripts can't find data files:
- Check that `src/config.py` has correct `PROJECT_ROOT`
- Verify data files exist in `Data/` directory
- Run scripts from project root directory

### Missing Dependencies
If a specific package fails:
```bash
# Install individually
pip install pandas
pip install numpy
pip install scikit-learn
pip install scipy
pip install statsmodels
pip install matplotlib
```

---

## 📊 Expected Outputs

After running all scripts, you should have:

**Processed Data:**
- `Data/Processed Data/DBH/*_long_with_growth.csv` (3 files)
- `Data/Processed Data/Carbon/*_with_carbon.csv` (3 files)
- `Data/Processed Data/Carbon/all_plots_with_carbon.csv`
- `Data/Processed Data/Carbon/all_plots_with_carbon_encoded.csv`

**Visualizations:**
- `Graphs/EDA_Figures/*.png` (14+ files)
- `Graphs/Modeling/Linear Regression/*.png` (10+ files)

**Models:**
- `Models/` directory (currently empty, ready for saved models)

---

## ✅ Success Criteria

You'll know everything is working when:
1. ✓ All packages install without errors
2. ✓ Data quality check passes
3. ✓ Scripts run without import errors
4. ✓ Visualizations are generated successfully
5. ✓ Model training completes and shows metrics

---

## 🎯 Next Development Steps

After verifying everything works:

1. **Save Models**: Modify `src/analysis/modeling.py` to save trained models
2. **Add Tests**: Create unit tests for forestry functions
3. **Documentation**: Add docstrings and usage examples
4. **API Integration**: Prepare for web app integration
5. **External Data**: Implement timber price crawler

---

## 📝 Notes

- All scripts should be run from the project root directory
- Data files are preserved in their current locations
- The new modular structure makes it easy to extend functionality
- Forestry modules can be imported and used independently

