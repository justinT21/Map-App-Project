import pandas as pd
import matplotlib.pyplot as plt
import math
import geojson
import json


class Point:
    _instances = {}

    # Singleton code ensures one instance of a point
    def __new__(cls, x, y):
        if (x, y) in cls._instances:
            return cls._instances[(x, y)]
        instance = super().__new__(cls)
        cls._instances[(x, y)] = instance
        return instance

    def __init__(self, x, y):
        self.x, self.y = (x, y)
        self.edges = set()

    def __str__(self):
        return "Point" + str((self.x, self.y))

    def __repr__(self):
        return "Point" + str((self.x, self.y))

    def addEdge(self, pt):
        self.edges.add(pt)

    def distancePoint(self, other):
        return math.sqrt((other.x - self.x) ** 2 + (other.y - self.y) ** 2)

    def distance(self, x, y):
        return math.sqrt((x - self.x) ** 2 + (y - self.y) ** 2)


class Graph:
    def __init__(self):
        self.points = {}

    def add_point(self, x, y):
        pt = Point(x, y)
        self.points[(x, y)] = pt
        return pt

    def add_edge(self, x1, y1, x2, y2):
        pt1 = self.points.get((x1, y1))
        if pt1 is None:
            pt1 = self.add_point(x1, y1)

        pt2 = self.points.get((x2, y2))
        if pt2 is None:
            pt2 = self.add_point(x2, y2)

        if pt1 and pt2:
            pt1.addEdge(pt2)
            pt2.addEdge(pt1)

    def __repr__(self):
        string = "Graph: "
        index = 0
        for point in list(self.points.values()):
            string += str(index) + ": " + str(point) + "\n"
            index += 1

        return string

    def __str__(self):
        string = "Graph: "
        index = 0
        for point in list(self.points.values()):
            string += str(index) + ": " + str(point) + "\n"
            index += 1

        return string

    def rotate_90deg(self):
        x_sum = 0
        y_sum = 0
        num_points = len(self.points)

        for pt in self.points.values():
            x_sum += pt.x
            y_sum += pt.y

        center_x = x_sum / num_points
        center_y = y_sum / num_points

        mapping = {}

        for pt in list(self.points.values()):
            translated_x = pt.x - center_x
            translated_y = pt.y - center_y

            rotated_x = translated_y
            rotated_y = -translated_x

            final_x = rotated_x + center_x
            final_y = rotated_y + center_y

            self.points.pop((pt.x, pt.y), None)
            new_pt = self.add_point(final_x, final_y)
            mapping[pt] = new_pt

        for old_pt, new_pt in mapping.items():
            for adjacent in old_pt.edges:
                if adjacent in mapping:
                    new_pt.addEdge(mapping[adjacent])

        print(f"Graph rotated 90 degrees around the centroid: ({center_x}, {center_y})")

    def interpolate(self, pt1_map: tuple, pt2_map: tuple):
        pt1, new_pt1 = pt1_map
        pt2, new_pt2 = pt2_map

        # Calculate the scaling factor
        xd1 = pt2.x - pt1.x
        yd1 = pt2.y - pt1.y

        xd2 = new_pt2.x - new_pt1.x
        yd2 = new_pt2.y - new_pt1.y

        x_scale = xd2 / xd1
        y_scale = yd2 / yd1

        # Calculate offsets for the new points

        x_tune = 0
        y_tune = 0

        x_offset = (
            (new_pt1.x - pt1.x * x_scale) + (new_pt2.x - pt2.x * x_scale)
        ) / 2 + x_tune
        y_offset = (
            (new_pt1.y - pt1.y * y_scale) + (new_pt2.y - pt2.y * y_scale)
        ) / 2 + y_tune

        mapping = {}

        # Iterate through the existing points and apply transformation
        for pt in list(self.points.values()):
            new_x = pt.x * x_scale + x_offset
            new_y = pt.y * y_scale + y_offset

            # Remove old point from points and add the transformed point
            del self.points[(pt.x, pt.y)]  # More efficient than pop()
            new_pt = self.add_point(new_x, new_y)

            mapping[pt] = new_pt

        # Update the edges based on the new points
        for old_pt, new_pt in mapping.items():
            for adjacent in old_pt.edges:
                if adjacent in mapping:
                    new_pt.addEdge(mapping[adjacent])

    def display(self):
        plt.figure(figsize=(8, 6))

        plotted_edges = set()

        for point in self.points.values():
            for neighbor in point.edges:
                x1, y1, x2, y2 = point.x, point.y, neighbor.x, neighbor.y

                if (x1, y1, x2, y2) in plotted_edges:
                    continue

                plotted_edges.add((x2, y2, x1, y1))

                plt.plot([x1, x2], [y1, y2], color="black")

                plt.text(
                    (x1 + x2) / 2,
                    (y1 + y2) / 2,
                    f"{point.distance(x2, y2):.2f}",
                    fontsize=0,
                    ha="center",
                    color="red",
                )

        points = self.points.keys()

        index = 0
        for x, y in points:
            color = "blue"
            s = 10
            plt.scatter(x, y, color=color, s=s)
            plt.text(x, y, f"{index}", fontsize=6)
            index += 1

        x_vals = [pt.x for pt in self.points.values()]
        y_vals = [pt.y for pt in self.points.values()]

        plt.xlim(min(x_vals), max(x_vals))
        plt.ylim(min(y_vals), max(y_vals))
        plt.xlabel("X-axis")
        plt.ylabel("Y-axis")
        plt.title("Graph Visualization")

        # Show the plot
        plt.grid(True)
        plt.show()

    def to_geojson(self, filepath: str):
        features = []

        # Add points as GeoJSON Features
        """
        for (x, y), point in self.points.items():
            features.append(
                geojson.Feature(
                    geometry=geojson.Point((x, y)), properties={"id": f"({x}, {y})"}
                )
            )

        """

        # Add edges as LineStrings
        added_edges = set()
        for point in self.points.values():
            for neighbor in point.edges:
                edge_tuple = tuple(
                    sorted([(point.x, point.y), (neighbor.x, neighbor.y)])
                )

                # skip dupes
                if edge_tuple in added_edges:
                    continue
                added_edges.add(edge_tuple)

                features.append(
                    geojson.Feature(
                        geometry=geojson.LineString(edge_tuple),
                        properties={
                            "stroke": "#0000FF",
                            "stroke-width": 4,
                            "stroke-opacity": 1,
                        },
                    )
                )

        # Create FeatureCollection
        geojson_data = geojson.FeatureCollection(features)

        # Save to file
        with open(filepath, "w") as f:
            json.dump(geojson_data, f, indent=2)

        print(f"GeoJSON saved to {filepath}")


df = pd.read_csv("data.csv")
graph = Graph()

for _, line in df.iterrows():
    graph.add_edge(line[0], line[1], line[2], line[3])

# (245) 1031.1445148051941 -179.0924576623372 : -122.066278, 37.361
# (303) 395.050514805194 -1770.3804576623374 : -122.068444, 37.357

graph.rotate_90deg()

pt1 = graph.points.get((1031.1445148051941, -179.0924576623372))
new_pt1 = Point(-122.066278, 37.361)

pt2 = graph.points.get((395.050514805194, -1770.3804576623374))
new_pt2 = Point(-122.068444, 37.357)

graph.interpolate((pt2, new_pt2), (pt1, new_pt1))
graph.to_geojson("./www/graph.json")
