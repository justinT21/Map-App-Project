import tkinter as tk
from PIL import Image, ImageTk
import json

class MapEditor:
    def __init__(self, master, image_path, locations_path):
        self.master = master
        self.image_path = image_path
        self.locations_path = locations_path
        self.locations = {}

        # Load image
        self.image = Image.open(self.image_path)
        self.tk_image = ImageTk.PhotoImage(self.image)

        # Create canvas
        self.canvas = tk.Canvas(self.master, width=self.image.width, height=self.image.height)
        self.canvas.pack()
        self.canvas.create_image(0, 0, anchor=tk.NW, image=self.tk_image)

        # Save button
        self.save_button = tk.Button(self.master, text="Save Locations", command=self.save_locations)
        self.save_button.pack()

        # Add button
        self.add_button = tk.Button(self.master, text="Add Location", command=self.add_location)
        self.add_button.pack()
        self.master.bind('a', lambda event: self.add_location())

        # Remove button
        self.remove_button = tk.Button(self.master, text="Remove Location", command=self.remove_location)
        self.remove_button.pack()

        # Bind click event
        self.canvas.bind("<Button-1>", self.on_click)
        self.canvas.bind("<B1-Motion>", self.on_drag)
        self.canvas.bind("<ButtonRelease-1>", self.on_release)

        # Load locations
        self.load_locations()

        # Display locations
        self.display_locations()

        self.selected_location = None

    def on_click(self, event):
        x, y = event.x, event.y
        for name, location in self.locations.items():
            loc_x, loc_y = location['x'], location['y']
            if (x - loc_x)**2 + (y - loc_y)**2 <= 25:  # Check if click is within 5 pixels
                self.selected_location = name
                print(f"Clicked on {name}")
                return

    def on_drag(self, event):
        if self.selected_location:
            x, y = event.x, event.y
            self.locations[self.selected_location]['x'] = x
            self.locations[self.selected_location]['y'] = y
            self.display_locations()  # Redraw locations

    def on_release(self, event):
        self.selected_location = None

    def remove_location(self):
        # Load locations
        self.load_locations()

        if self.selected_location:
            del self.locations[self.selected_location]
            self.selected_location = None
            self.save_locations()

        # Display locations
        self.display_locations()

        self.selected_location = None

    def add_location(self):
        print("add_location called")
        def save_new_location():
            add_window.destroy()

        add_window = tk.Toplevel(self.master)
        add_window.title("Add New Location")

        name_label = tk.Label(add_window, text="Name:")
        name_label.grid(row=0, column=0)
        name_entry = tk.Entry(add_window)
        name_entry.grid(row=0, column=1)
        name_entry.focus_set()

        self.canvas.bind("<ButtonRelease-3>", lambda event: self.on_canvas_click(event, name_entry, add_window))

    def on_canvas_click(self, event, name_entry, add_window):
        print("on_canvas_click called")
        x, y = event.x, event.y
        name = name_entry.get()
        new_id = name.lower().replace(" ", "")
        self.locations[name] = {'id': new_id, 'name': name, 'x': x, 'y': y}
        self.display_locations()
        add_window.destroy()
        self.canvas.unbind("<ButtonRelease-3>")

    def load_locations(self):
        try:
            with open(self.locations_path, 'r') as f:
                data = json.load(f)
                if isinstance(data, list):
                    self.locations = {loc.get('name', str(i)): loc for i, loc in enumerate(data)}
                else:
                    self.locations = data
        except FileNotFoundError:
            print("Error: locations.json not found.")
            self.locations = {}
        except json.JSONDecodeError:
            print("Error: Invalid JSON in locations.json.")
            self.locations = {}

    def display_locations(self):
        self.canvas.delete("all")
        self.canvas.create_image(0, 0, anchor=tk.NW, image=self.tk_image)
        for name, location in self.locations.items():
            x, y = location['x'], location['y']
            self.canvas.create_oval(x-5, y-5, x+5, y+5, fill='red', tags=name)
            self.canvas.create_text(x, y-10, text=name, fill='blue', tags=name)

    def save_locations(self):
        with open(self.locations_path, 'w') as f:
            json.dump(list(self.locations.values()), f, indent=4)
        self.display_locations()

if __name__ == '__main__':
    root = tk.Tk()
    app = MapEditor(root, 'SchoolMap.png', 'www/locations.json')
    root.mainloop()
