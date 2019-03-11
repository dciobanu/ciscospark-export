# Export your spark data


## Using Docker

### Build
```
docker build -t cisco-spark-export .
```

### Run
```
mkdir output
docker run -v output:/output cisco-spark-export TOKEN
docker run -v output:/output cisco-spark-export TOKEN # Due to a race condition it may have failed first time. Run again.
```
