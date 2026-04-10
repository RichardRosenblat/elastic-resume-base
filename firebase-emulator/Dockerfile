FROM node:22-alpine

# Java JRE is required for Firestore and Pub/Sub emulators
RUN apk add --no-cache openjdk17-jre

RUN npm install -g firebase-tools

WORKDIR /srv/firebase

COPY firebase.json ./

EXPOSE 9099 8080 8085 4000

CMD ["firebase", "emulators:start", "--project", "demo-elastic-resume-base", "--host", "0.0.0.0"]
