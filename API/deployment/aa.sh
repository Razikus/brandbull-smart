# Method 1: Using kubectl create secret
kubectl create secret docker-registry gitlab-registry-secret \
  --docker-server=registry.gitlab.com \
  --docker-username=Razniewski \
  --docker-password=glpat-kaFJkOh0bjukRpRadg43N286MQp1OjE3NHIzCw.01.1207suilt \
  --docker-email=adam@razniewski.eu


kubectl create secret generic bbsmart-env-secret \
  --from-literal=SUPABASE_SERVICE_KEY='sb_secret_ZyWQ03m3c_CxN38MyxAviQ_b4OZy4B5' \
  --from-literal=HEIMAN_CLIENT_ID='SB7sFDXHe3WQyF7k' \
  --from-literal=HEIMAN_CLIENT_SECRET='K2rDXbNbF3hfc3Z7RDXPmYHGm54b6fCD'