FROM python:3.11-slim

# Use /app as the root so that the shared/ and file-generator/ sub-trees
# sit side-by-side, mirroring the monorepo layout on disk.
# This lets requirements reference ../shared/<lib>/<lib_lower>_py as relative paths.
WORKDIR /app

# Copy shared Python libraries first so pip can resolve local path references.
COPY shared/Toolbox/v1/toolbox_py/ ./shared/Toolbox/v1/toolbox_py/
COPY shared/Bowltie/v1/bowltie_py/ ./shared/Bowltie/v1/bowltie_py/
COPY shared/Bugle/v2/bugle_py/ ./shared/Bugle/v2/bugle_py/
COPY shared/Synapse/v1/synapse_py/ ./shared/Synapse/v1/synapse_py/

# Switch into the service sub-directory.  From here ../../shared/... resolves
# to /app/shared/... which was just copied above.
WORKDIR /app/apps/file-generator

COPY apps/file-generator/requirements/ ./requirements/
RUN pip install --no-cache-dir -r requirements/requirements-prod.txt

COPY apps/file-generator/app/ ./app/

EXPOSE 8003

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8003"]
