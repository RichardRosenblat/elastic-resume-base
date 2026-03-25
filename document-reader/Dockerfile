FROM python:3.11-slim

# Use /app as the root so that the shared/ and document-reader/ sub-trees
# sit side-by-side, mirroring the monorepo layout on disk.
# This lets requirements.txt reference ../shared/Toolbox as a relative path.
WORKDIR /app

# Copy shared Python libraries first so pip can resolve local path references.
COPY shared/Toolbox/ ./shared/Toolbox/

# Switch into the service sub-directory.  From here ../shared/Toolbox resolves
# to /app/shared/Toolbox which was just copied above.
WORKDIR /app/document-reader

COPY document-reader/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY document-reader/app/ ./app/

EXPOSE 8004

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8004"]
