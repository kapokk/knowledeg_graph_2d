import os

class Config:
    NEO4J_URI = os.getenv('NEO4J_URI', 'bolt://localhost:7687')
    NEO4J_USER = os.getenv('NEO4J_USER', 'neo4j')
    NEO4J_PASSWORD = os.getenv('NEO4J_PASSWORD', 'AGCF3xJumbfJD-b')
    SECRET_KEY = os.getenv('SECRET_KEY', 'your-secret-key')
