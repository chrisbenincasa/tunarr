FROM squidfunk/mkdocs-material

# Install additional Python packages (example)
RUN pip install mkdocs-glightbox mike

EXPOSE 8000
