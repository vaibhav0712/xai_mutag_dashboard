# Mutagenicity GNN Explainer Dashboard

An interactive web dashboard that visualizes **explainable AI (XAI)** outputs for a
Graph Neural Network (GNN) trained on the **Mutagenicity** dataset.

The dashboard lets you pick a molecule from the train/test split, run the trained
RGCN model to get a **Mutagenic / Non-mutagenic** prediction, and then visualizes the
**GNNExplainer** subgraph that highlights which atoms (nodes) and bonds (edges) were
most important for the model's decision.

---

## Folder Structure

A high-level overview of the project layout:

- **`kgvisualizer/`**: Root Django project configuration (routing settings, WSGI/ASGI configurations).
- **`graph/`**: The main application folder containing:
  - Back-end code (Django views and the PyTorch/GNNExplainer pipeline).
  - Pre-trained models, datasets, and splits (`resources/`).
  - Web UI frontend templates and Cytoscape/graph-rendering scripts.
- **Root Configuration**: Project deployment and dependency files (`Dockerfile`, `docker-compose.yml`, `requirements.txt`, `package.json`).

---

## Run the Dashboard with Docker Compose

### 1. Install Docker

You need **Docker Engine** + **Docker Compose** (or Docker Desktop) on your machine.

#### Windows / macOS
1. Download and install **Docker Desktop** from [Docker's official website](https://www.docker.com/products/docker-desktop/).
2. Start **Docker Desktop** and wait until the engine is fully running (the whale icon in the status bar/system tray is steady).
3. Docker Compose is bundled with Docker Desktop — nothing extra to install.

#### Linux (Ubuntu / Debian / CentOS)
1. Install Docker Engine and the Docker Compose plugin by following the official guide for your distribution:
   - [Install Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/)
   - [Install Docker Engine on Debian](https://docs.docker.com/engine/install/debian/)
2. Start and enable the Docker service:
   ```bash
   sudo systemctl enable --now docker
   ```

> [!IMPORTANT]
> **Linux sudo Requirement:**
> On Linux systems, the Docker daemon binds to a Unix socket which is owned by the `root` user by default. Unless you have configured rootless Docker or added your user to the `docker` group, **you must run all Docker commands with `sudo`** (e.g., `sudo docker compose up --build`).
>
> *Tip:* To run Docker without `sudo`, you can follow the official [Docker post-installation steps for Linux](https://docs.docker.com/engine/install/linux-postinstall/) to add your user account to the `docker` group.

Verify the install:
```bash
# On Windows/macOS (or Linux with user in 'docker' group):
docker --version
docker compose version

# On Linux (without 'docker' group configuration):
sudo docker --version
sudo docker compose version
```

### 2. Build and Run

From the project root (where `docker-compose.yml` lives), run:

```bash
# On Windows/macOS (or Linux with user in 'docker' group):
docker compose up --build

# On Linux (without 'docker' group configuration):
sudo docker compose up --build
```

The first build downloads Python 3.11, installs PyTorch / PyG / Django and copies the project into the image — this may take a few minutes. Subsequent starts are fast.

### 3. Open the Dashboard

Once the container is running, open your browser and go to:

```
http://localhost:8000
```

You should land on the **"Select Molecule for XAI Explanation"** page.

### 4. Using the Dashboard

1. Use the **Training Set / Testing Set** tabs to switch splits.
2. Search a molecule by ID (e.g. `d76`) in the search box.
3. Click any molecule card — the app runs the RGCN model and GNNExplainer.
4. The **Dashboard View** shows:
   - Predicted class (**Mutagenic / Non-mutagenic**) + confidence.
   - True class from the dataset.
   - An interactive Cytoscape graph where node/edge sizes and colors reflect their **importance score** for the model's prediction.

### 5. Stop the Container

In the terminal where it's running, press `Ctrl+C`. To remove the stopped container, run:

```bash
# On Windows/macOS (or Linux with user in 'docker' group):
docker compose down

# On Linux (without 'docker' group configuration):
sudo docker compose down
```

### Useful Port Reference

| Service | Host port | Container port | URL |
|---------|-----------|----------------|-----|
| Web app | 8000      | 8000           | http://localhost:8000 |

If port 8000 is already in use, edit `docker-compose.yml` and change the left
side of `"8000:8000"` to any free port, e.g. `"8080:8000"`, then restart with
`docker compose up`.
