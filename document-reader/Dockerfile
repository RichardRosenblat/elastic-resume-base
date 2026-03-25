FROM python:3.11-slim

# Use /app as the root so that the shared/ and document-reader/ sub-trees
# sit side-by-side, mirroring the monorepo layout on disk.
# This lets requirements reference ../shared/<lib>/<lib_lower>_py as relative paths.
WORKDIR /app

# Copy shared Python libraries first so pip can resolve local path references.
COPY shared/Toolbox/toolbox_py/ ./shared/Toolbox/toolbox_py/
COPY shared/Hermes/hermes_py/ ./shared/Hermes/hermes_py/
COPY shared/Bowltie/bowltie_py/ ./shared/Bowltie/bowltie_py/

# Switch into the service sub-directory.  From here ../shared/... resolves
# to /app/shared/... which was just copied above.
WORKDIR /app/document-reader

COPY document-reader/requirements/ ./requirements/
RUN pip install --no-cache-dir -r requirements/requirements-prod.txt

COPY document-reader/app/ ./app/

EXPOSE 8004

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8004"]
