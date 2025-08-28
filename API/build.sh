TAG=api2.8
docker build -t registry.gitlab.com/razniewski/bbsmart:$TAG .
docker push registry.gitlab.com/razniewski/bbsmart:$TAG
