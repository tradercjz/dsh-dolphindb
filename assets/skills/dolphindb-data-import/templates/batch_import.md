# Batch File Import Template

## Serial Import (Safe, No Partition Conflict)

```sql
def batchImport(dbPath, tableName, partCol, fileDir, sortCols) {
    db = database(dbPath)
    filenames = exec filename from files(fileDir)
    for (fname in filenames) {
        loadTextEx(db, tableName, partCol, fileDir + "/" + fname, sortColumns=sortCols)
    }
}

submitJob("batchImport", "batch CSV/TXT import", batchImport,
          "dfs://stock", "trades", `date, "/data/daily/", `sym`date)
```

## Parallel Import (Different Partitions Only)

```sql
def parallelImport(dbPath, tableName, partCol, fileDir) {
    db = database(dbPath)
    filenames = exec filename from files(fileDir)
    for (fname in filenames) {
        jobId = fname.strReplace(".csv", "").strReplace(".txt", "")
        submitJob(jobId, "import " + fname,
                  loadTextEx, db, tableName, partCol, fileDir + "/" + fname)
    }
}
// Only safe when each file maps to a different partition!
```

## Batch Small Files via Merge

```sql
dir = "/data/small_files/"
allFiles = exec filename from files(dir)
batchNum = 1000
i = 0
s = allFiles.size()
do {
    batchFiles = allFiles[i:min(i+batchNum, s)]
    data = each(loadText, dir + batchFiles).unionAll(false)
    loadTable("dfs://mydb", "mytable").append!(data)
    i = i + batchNum
} while (i < s)
```

## Monitor Import Jobs

```sql
// Check recent jobs
select * from getRecentJobs() where jobDesc like "%import%"

// Check running jobs
select * from getRunningJobs()
```
