FROM squidfunk/mkdocs-material

# Install additional Python packages (example)
RUN pip install mkdocs-glightbox mike

COPY ./docs /data/docs-dev

EXPOSE 8000

ENTRYPOINT [ "mike", "serve" ]