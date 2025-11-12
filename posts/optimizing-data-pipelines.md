---
title: "Optimizing Data Pipelines: From Hours to Minutes"
date: "2025-01-05"
tags: ["Data Engineering", "Python", "Tutorial"]
excerpt: "A case study on optimizing a slow data pipeline using DuckDB, reducing processing time by 95%."
---

# Optimizing Data Pipelines: From Hours to Minutes

Last month, I inherited a data pipeline that processed 10M records in 4 hours. By the time I was done optimizing it, the same workload finished in 12 minutes - a **95% reduction** in processing time.

Here's how I did it.

## The Problem

The pipeline was straightforward but slow:

```python
# Original implementation
def process_data():
    # Load data from S3
    df = pd.read_csv('s3://bucket/data.csv')  # 10M rows

    # Process in memory
    df['score'] = df.apply(calculate_score, axis=1)
    df_filtered = df[df['score'] > 0.5]

    # Aggregate
    result = df_filtered.groupby('user_id').agg({
        'score': 'mean',
        'value': 'sum'
    })

    # Save to S3
    result.to_csv('s3://bucket/output.csv')
```

**Problems:**
- Loads entire dataset into memory (OOM errors on large files)
- `apply()` is slow on large DataFrames
- No parallelization
- Inefficient I/O

**Metrics (10M rows):**
- **Runtime:** 4 hours 12 minutes
- **Memory peak:** 16 GB
- **Cost:** $4.50 per run (EC2 m5.2xlarge)

## Optimization 1: Chunked Processing

First attempt: Process data in chunks instead of loading everything:

```python
def process_chunked():
    results = []

    for chunk in pd.read_csv('s3://bucket/data.csv', chunksize=100000):
        chunk['score'] = chunk.apply(calculate_score, axis=1)
        filtered = chunk[chunk['score'] > 0.5]
        results.append(filtered)

    df_final = pd.concat(results)
    # Rest of processing...
```

**Impact:**
- Memory reduced from 16GB to 2GB ✅
- Runtime: 3 hours 45 minutes ❌ (still too slow)

## Optimization 2: Vectorization

Rewrote `calculate_score` to use vectorized operations:

```python
# Before: Row-by-row
def calculate_score(row):
    return row['a'] * 0.5 + row['b'] * 0.3 + row['c'] * 0.2

df['score'] = df.apply(calculate_score, axis=1)  # 45 minutes
```

```python
# After: Vectorized
df['score'] = df['a'] * 0.5 + df['b'] * 0.3 + df['c'] * 0.2  # 12 seconds
```

**Impact:**
- Runtime: 2 hours 15 minutes (46% improvement!)
- Memory: Still 2GB

## Optimization 3: Enter DuckDB

This was the game-changer. DuckDB is an in-process analytical database that's perfect for data pipelines:

```python
import duckdb

def process_with_duckdb():
    conn = duckdb.connect()

    # Read directly from S3 (no loading to memory!)
    conn.execute("""
        CREATE TABLE data AS
        SELECT *
        FROM read_csv_auto('s3://bucket/data.csv')
    """)

    # Compute score and filter (pushed down to DB)
    conn.execute("""
        CREATE TABLE filtered AS
        SELECT
            user_id,
            (a * 0.5 + b * 0.3 + c * 0.2) AS score,
            value
        FROM data
        WHERE (a * 0.5 + b * 0.3 + c * 0.2) > 0.5
    """)

    # Aggregate
    result = conn.execute("""
        SELECT
            user_id,
            AVG(score) as avg_score,
            SUM(value) as total_value
        FROM filtered
        GROUP BY user_id
    """).df()

    # Save
    result.to_csv('s3://bucket/output.csv')
```

**Impact:**
- Runtime: **18 minutes** (92% improvement!)
- Memory: 800MB (Peak)
- Cost: $0.45 per run

## Optimization 4: Parallel Processing

For the final push, I parallelized across multiple files:

```python
import concurrent.futures
from functools import partial

def process_file(file_path: str):
    conn = duckdb.connect()
    # Process single file...
    return result

def process_parallel():
    files = [
        's3://bucket/data_part_1.csv',
        's3://bucket/data_part_2.csv',
        # ... 10 files total
    ]

    with concurrent.futures.ProcessPoolExecutor(max_workers=4) as executor:
        results = list(executor.map(process_file, files))

    # Combine results
    final = pd.concat(results)
    return final
```

**Impact:**
- Runtime: **12 minutes** (95% total improvement!)
- Memory: 800MB per process
- Cost: $0.30 per run

## Side-by-Side Comparison

| Approach | Runtime | Memory | Cost | Code Complexity |
|----------|---------|--------|------|----------------|
| Original Pandas | 4h 12m | 16GB | $4.50 | Low |
| Chunked Processing | 3h 45m | 2GB | $4.00 | Medium |
| Vectorized Pandas | 2h 15m | 2GB | $2.50 | Medium |
| DuckDB | 18m | 800MB | $0.45 | Low |
| DuckDB + Parallel | **12m** | **800MB** | **$0.30** | Medium |

## Why DuckDB is Amazing

1. **Columnar Storage** - Only reads columns you need
2. **Lazy Evaluation** - Optimizes query before execution
3. **Vectorized Engine** - SIMD operations for speed
4. **Direct S3 Access** - No need to download first
5. **SQL Interface** - Easier than pandas for complex operations

## Real-World Code Comparison

### Pandas (Complex Aggregation):

```python
df_filtered = df[
    (df['date'] >= '2024-01-01') &
    (df['status'] == 'active') &
    (df['score'] > 0.5)
]

result = df_filtered.groupby(['user_id', 'category']).agg({
    'value': ['sum', 'mean', 'std'],
    'score': ['min', 'max'],
    'count': 'sum'
}).reset_index()

result.columns = ['_'.join(col).strip() for col in result.columns]
```

### DuckDB (Same Operation):

```python
result = conn.execute("""
    SELECT
        user_id,
        category,
        SUM(value) as total_value,
        AVG(value) as avg_value,
        STDDEV(value) as std_value,
        MIN(score) as min_score,
        MAX(score) as max_score,
        SUM(count) as total_count
    FROM data
    WHERE date >= '2024-01-01'
        AND status = 'active'
        AND score > 0.5
    GROUP BY user_id, category
""").df()
```

Much cleaner and **10x faster**!

## Lessons Learned

### 1. Profile First

Use Python's profiler to find bottlenecks:

```python
import cProfile

cProfile.run('process_data()')
```

Don't optimize blindly - measure first.

### 2. The Right Tool for the Job

Pandas is great for:
- Small to medium datasets (<1GB)
- Interactive analysis
- Data cleaning

DuckDB is great for:
- Large datasets (>1GB)
- Analytical queries
- Production pipelines

### 3. Parallelize When Possible

If your data can be split, parallelize:

```python
# Good for parallelization
files = ['part_1.csv', 'part_2.csv', ...]

# Hard to parallelize
single_file = 'huge_file.csv'
```

### 4. Push Down Computations

Do filtering and aggregation in the database, not in Python:

```python
# Bad: Pull all data then filter
df = pd.read_sql('SELECT * FROM table', conn)
filtered = df[df['score'] > 0.5]

# Good: Filter in database
df = pd.read_sql(
    'SELECT * FROM table WHERE score > 0.5',
    conn
)
```

## Beyond DuckDB: Other Options

Depending on your use case, consider:

1. **Polars** - Faster than pandas, pure Python
2. **Apache Arrow** - For large inter-process data sharing
3. **Dask** - For distributed computing
4. **Spark** - For truly massive datasets (100GB+)

## Performance Checklist

When optimizing data pipelines, ask:

- [ ] Am I loading unnecessary columns?
- [ ] Can I filter data earlier in the pipeline?
- [ ] Am I using vectorized operations?
- [ ] Can this operation be parallelized?
- [ ] Am I using the right tool for the data size?
- [ ] Have I profiled to find the real bottleneck?

## Final Thoughts

The 95% speedup came from:
- **40%** - Switching to DuckDB
- **30%** - Vectorization
- **25%** - Parallelization

But more importantly, the cost dropped from $4.50 to $0.30 per run. Over a year, that's **$15,000 in savings**.

Performance optimization isn't just about speed - it's about cost-effectiveness.

## Try It Yourself

```bash
pip install duckdb pandas

# Example script
python -c "
import duckdb
conn = duckdb.connect()
result = conn.execute('''
    SELECT COUNT(*) FROM read_csv_auto('your_file.csv')
''').fetchone()
print(f'Rows: {result[0]}')
"
```

---

*Questions? Find me on [LinkedIn](https://linkedin.com/in/sarvesh-ganesan09) or [GitHub](https://github.com/Sarvesh-GanesanW).*
