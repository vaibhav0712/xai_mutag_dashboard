import os
import json
from pathlib import Path

from django.http import JsonResponse
from django.shortcuts import render
from django.conf import settings

BASE_DIR = Path(__file__).resolve().parent

# Global for GNN pipeline resources
pipeline_resources = None

def get_pipeline():
    """
    Lazily initializes the PyTorch GNN XAI Explainer pipeline.
    """
    global pipeline_resources
    if pipeline_resources is None:
        from graph.explain import initialize_xai_pipeline
        
        # Paths relative to graph app directory
        resources_dir = BASE_DIR / "resources"
        model_path = resources_dir / "rgnn_model_checkpoint.pt"
        dataset_path = resources_dir / "pyg_dataset.pt"
        rdf_path = resources_dir / "mutag_stripped.nt"
        
        print(f"[INFO] Lazily loading GNN pipeline from resources: {resources_dir}")
        pipeline_resources = initialize_xai_pipeline(model_path, dataset_path, rdf_path)
    return pipeline_resources


def graph_view(request):
    """
    Renders the molecular XAI explainer dashboard.
    """
    return render(
        request,
        "graph/index.html"
    )


def load_molecules():
    """
    Parses the train/test splits from trainingSet.tsv and testSet.tsv.
    """
    resources_dir = BASE_DIR / "resources"
    train_path = resources_dir / "trainingSet.tsv"
    test_path = resources_dir / "testSet.tsv"
    
    train_mols = []
    test_mols = []
    
    if train_path.exists():
        with open(train_path, "r", encoding="utf-8") as f:
            lines = f.readlines()[1:] # skip header
            for line in lines:
                parts = line.strip().split("\t")
                if len(parts) >= 3:
                    uri = parts[0]
                    mol_id = uri.split("#")[-1]
                    label = int(float(parts[2]))
                    train_mols.append({
                        "uri": uri,
                        "id": mol_id,
                        "label": label
                    })
                    
    if test_path.exists():
        with open(test_path, "r", encoding="utf-8") as f:
            lines = f.readlines()[1:] # skip header
            for line in lines:
                parts = line.strip().split("\t")
                if len(parts) >= 3:
                    uri = parts[0]
                    mol_id = uri.split("#")[-1]
                    label = int(float(parts[2]))
                    test_mols.append({
                        "uri": uri,
                        "id": mol_id,
                        "label": label
                    })
                    
    return train_mols, test_mols


def api_molecules(request):
    """
    Endpoint returning lists of molecules in training and test splits.
    """
    try:
        train_mols, test_mols = load_molecules()
        return JsonResponse({
            "train": train_mols,
            "test": test_mols
        })
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


def api_explain(request):
    """
    Triggers explanation generation for a given molecule URI.
    """
    uri = request.GET.get("uri")
    if not uri:
        return JsonResponse({"error": "Molecule URI is required"}, status=400)
        
    try:
        resources = get_pipeline()
        
        from graph.explain import generate_explanation_payload
        payload_str = generate_explanation_payload(uri, resources)
        
        # Save to payload.json at the project root level (same level as manage.py / code)
        project_root = BASE_DIR.parent
        payload_path = project_root / "payload.json"
        with open(payload_path, "w", encoding="utf-8") as f:
            f.write(payload_str)
            
        payload = json.loads(payload_str)
        
        if "error" in payload:
            return JsonResponse(payload, status=400)
            
        normalized = normalize_explanation(payload)
        return JsonResponse(normalized)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({"error": str(e)}, status=500)


def normalize_explanation(data):
    """
    Normalizes PyG explanation data schema into visualizable structures.
    """
    nodes = []
    edges = []
    
    raw_nodes = data.get("graph", {}).get("nodes", [])
    raw_links = data.get("graph", {}).get("links", [])
    
    for node in raw_nodes:
        node_id = str(node.get("id"))
        element = node.get("element", "Unknown")
        importance = float(node.get("importance_score", 1.0))
        uri = node.get("uri", "")
        
        # Display label: "Carbon (d76_1)" or "Carbon"
        label = f"{element} ({uri})" if uri else element
        
        nodes.append({
            "id": node_id,
            "label": label,
            "is_target": False,
            "is_prediction": False,
            "importance_score": importance,
            "element": element
        })
        
    for i, link in enumerate(raw_links):
        source = str(link.get("source"))
        target = str(link.get("target"))
        edge_type = link.get("type", "connected_to")
        
        # Read connection importance score directly from GNNExplainer output
        importance = float(link.get("importance_score", 1.0))
            
        edges.append({
            "id": f"edge_{i}",
            "source": source,
            "target": target,
            "label": edge_type,
            "importance_score": importance
        })
        
    return {
        "target_node_id": "",
        "target_label": data.get("metadata", {}).get("molecule_id", "Molecule"),
        "predicted_class": "Mutagenic" if int(data.get("prediction", {}).get("predicted_class", 0)) == 1 else "Non-mutagenic",
        "predicted_class_val": int(data.get("prediction", {}).get("predicted_class", 0)),
        "confidence": float(data.get("prediction", {}).get("confidence", 1.0)),
        "true_class": "Mutagenic" if int(data.get("metadata", {}).get("true_class", 0)) == 1 else "Non-mutagenic",
        "graph_data": {
            "nodes": nodes,
            "edges": edges
        }
    }