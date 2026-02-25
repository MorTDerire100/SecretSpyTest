import tkinter as tk
from tkinter import scrolledtext, messagebox
import json

# Relative coordinates maintained for spatial accuracy
CITIES = {
    "London": (130, 374), "Amsterdam": (290, 370), "Paris": (128, 520),
    "Brussels": (224, 472), "Geneva": (268, 578), "Monaco": (264, 694),
    "Rome": (426, 788), "Venice": (406, 668), "Vienna": (508, 578),
    "Berlin": (426, 414), "Warsaw": (658, 424), "Belgrade": (656, 698),
    "Kyiv": (834, 446), "Istanbul": (840, 784), "Moscow": (896, 218),
    "Stockholm": (522, 140)
}

class CityMapperApp:
    def __init__(self, root):
        # DPI Awareness for 1440p clarity
        try:
            from ctypes import windll
            windll.shcore.SetProcessDpiAwareness(1)
        except:
            pass

        self.root = root
        self.root.title("Schematic City Connector")
        
        self.connections = []
        self.selected_city = None
        self.city_buttons = {}

        # Main Layout
        self.main_frame = tk.Frame(root, bg="#2c3e50")
        self.main_frame.pack(fill=tk.BOTH, expand=True)

        # Left Side: Canvas (The "Map" area)
        # Increased width/height to accommodate the coordinate spread
        self.canvas = tk.Canvas(self.main_frame, width=1050, height=950, 
                               bg="#ecf0f1", highlightthickness=0)
        self.canvas.pack(side=tk.LEFT, padx=10, pady=10)

        # Right Side: Control Panel
        self.panel = tk.Frame(self.main_frame, width=300, padx=15, pady=15, bg="#2c3e50")
        self.panel.pack(side=tk.RIGHT, fill=tk.Y)

        tk.Label(self.panel, text="DATA PANEL", font=("Arial", 12, "bold"), 
                 bg="#2c3e50", fg="white").pack(pady=5)
        
        self.gen_btn = tk.Button(self.panel, text="GENERATE JSON", command=self.generate_json, 
                                 bg="#27ae60", fg="white", font=("Arial", 10, "bold"), height=2)
        self.gen_btn.pack(fill=tk.X, pady=10)

        self.clear_btn = tk.Button(self.panel, text="Clear All", command=self.clear_all,
                                  bg="#c0392b", fg="white")
        self.clear_btn.pack(fill=tk.X)

        self.text_area = scrolledtext.ScrolledText(self.panel, width=35, height=40, font=("Consolas", 10))
        self.text_area.pack(fill=tk.BOTH, expand=True, pady=10)

        self.place_city_elements()

    def place_city_elements(self):
        """Places buttons and labels based on city coordinates."""
        for name, (x, y) in CITIES.items():
            # Create a frame to hold the label and button together
            container = tk.Frame(self.canvas, bg="#ecf0f1")
            
            # Label above the button
            lbl = tk.Label(container, text=name, font=("Arial", 8, "bold"), bg="#ecf0f1")
            lbl.pack(side=tk.TOP)
            
            # The actual button
            btn = tk.Button(container, text="●", bg="black", fg="white",
                            width=2, height=1, relief="flat",
                            command=lambda n=name: self.on_city_press(n))
            btn.pack(side=tk.TOP)
            
            # Place the container onto the canvas
            self.canvas.create_window(x, y, window=container, anchor=tk.CENTER)
            self.city_buttons[name] = btn

    def on_city_press(self, city_name):
        if self.selected_city is None:
            self.selected_city = city_name
            self.city_buttons[city_name].config(bg="#f1c40f", fg="black") # Highlight Yellow
        else:
            if self.selected_city != city_name:
                # Add connection
                self.connections.append({"from": self.selected_city, "to": city_name})
                
                # Draw visual line
                x1, y1 = CITIES[self.selected_city]
                x2, y2 = CITIES[city_name]
                self.canvas.create_line(x1, y1, x2, y2, fill="#3498db", width=3, tags="line")
                
                # Reset UI state
                self.city_buttons[self.selected_city].config(bg="black", fg="white")
                self.selected_city = None
            else:
                # Deselect if clicking the same button
                self.city_buttons[self.selected_city].config(bg="black", fg="white")
                self.selected_city = None

    def generate_json(self):
        output = json.dumps(self.connections, indent=4)
        self.text_area.delete(1.0, tk.END)
        self.text_area.insert(tk.END, output)

    def clear_all(self):
        self.connections = []
        self.canvas.delete("line")
        self.text_area.delete(1.0, tk.END)
        if self.selected_city:
            self.city_buttons[self.selected_city].config(bg="black", fg="white")
            self.selected_city = None

if __name__ == "__main__":
    root = tk.Tk()
    app = CityMapperApp(root)
    root.mainloop()