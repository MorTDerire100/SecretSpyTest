import cv2
import numpy as np
from skimage.morphology import skeletonize
import math

# --- CONFIG ---
LINE_COLOR_BGR = np.array([54, 94, 142])
TOLERANCE = 40
CITY_RADIUS = 15 # Area around city center to 'catch' the line

def get_vector(p1, p2):
    """Calculates the directional vector between two points."""
    return (p2[0] - p1[0], p2[1] - p1[1])

def dot_product(v1, v2):
    """Returns the similarity of two vectors (higher is more aligned)."""
    mag1 = math.sqrt(v1[0]**2 + v1[1]**2)
    mag2 = math.sqrt(v2[0]**2 + v2[1]**2)
    if mag1 == 0 or mag2 == 0: return 0
    return (v1[0]*v2[0] + v1[1]*v2[1]) / (mag1 * mag2)

def trace_connection(start_city, target_city, skeleton, coords):
    start_pos = coords[start_city]
    end_pos = coords[target_city]
    
    # Find starting pixel on skeleton near the city
    y_coords, x_coords = np.where(skeleton > 0)
    current_pixel = None
    min_dist = float('inf')
    
    for y, x in zip(y_coords, x_coords):
        d = math.dist((x, y), start_pos)
        if d < min_dist and d < CITY_RADIUS:
            min_dist = d
            current_pixel = (x, y)
            
    if not current_pixel: return False

    visited = set()
    path = [current_pixel]
    
    # Simple 'driver' loop
    for _ in range(2000): # Safety limit to prevent infinite loops
        visited.add(current_pixel)
        x, y = current_pixel
        
        # Look at neighbors (8-connectivity)
        neighbors = []
        for dx in [-1, 0, 1]:
            for dy in [-1, 0, 1]:
                nx, ny = x + dx, y + dy
                if (nx, ny) != current_pixel and 0 <= ny < skeleton.shape[0] and 0 <= nx < skeleton.shape[1]:
                    if skeleton[ny, nx] > 0 and (nx, ny) not in visited:
                        neighbors.append((nx, ny))
        
        if not neighbors:
            # Check if we are close to the target city before giving up
            if math.dist(current_pixel, end_pos) < CITY_RADIUS:
                return True
            break
            
        if len(neighbors) == 1:
            current_pixel = neighbors[0]
        else:
            # INTERSECTION LOGIC: Pick neighbor that best matches our current momentum
            if len(path) < 3:
                current_pixel = neighbors[0] # Not enough data, just pick one
            else:
                prev_vec = get_vector(path[-3], path[-1])
                best_neighbor = neighbors[0]
                best_score = -1
                
                for n in neighbors:
                    n_vec = get_vector(current_pixel, n)
                    score = dot_product(prev_vec, n_vec)
                    if score > best_score:
                        best_score = score
                        best_neighbor = n
                current_pixel = best_neighbor
        
        path.append(current_pixel)
        if math.dist(current_pixel, end_pos) < CITY_RADIUS:
            return True
            
    return False

def analyze_map(img_path, city_dict):
    img = cv2.imread(img_path)
    # Masking the brown roads
    lower = np.clip(LINE_COLOR_BGR - TOLERANCE, 0, 255)
    upper = np.clip(LINE_COLOR_BGR + TOLERANCE, 0, 255)
    mask = cv2.inRange(img, lower, upper)
    
    # Clean up the mask (close small gaps in dashed lines)
    kernel = np.ones((5,5), np.uint8)
    mask = cv2.dilate(mask, kernel, iterations=1)
    
    # Convert to 0/1 skeleton
    skel = skeletonize(mask > 0).astype(np.uint8)
    
    connections = []
    cities = list(city_dict.keys())
    
    for i in range(len(cities)):
        for j in range(i + 1, len(cities)):
            if trace_connection(cities[i], cities[j], skel, city_dict):
                connections.append([cities[i], cities[j]])
                
    return connections