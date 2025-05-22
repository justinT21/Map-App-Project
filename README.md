Install CGAL `sudo apt-get install libcgal-dev` and `sudo apt-get install libcgal-qt5-dev`

To get cgal examples run `wget https://github.com/CGAL/cgal/releases/download/v5.5.4/CGAL-5.5.4-examples.tar.xz` and untar it

Install OpenCV, follow instructions here: https://docs.opencv.org/4.x/d7/d9f/tutorial_linux_install.html

run `wget https://www.dropbox.com/s/r2ingd0l3zt8hxs/frozen_east_text_detection.tar.gz?dl=1` and untar the result and rename it to `EAST.pb`

Tesseract is needed, however it is not used: run `sudo apt install tesseract-ocr` and `sudo apt install libtesseract-dev`, if using the legacy model, you need to run `sudo wget https://github.com/tesseract-ocr/tessdata/raw/main/eng.traineddata` in the location of the trained data

To Build run `cmake -DCMAKE_BUILD_TYPE=Release .` and `make`
All executables get put into ./bin

## Running the Web Application

To avoid CORS issues when loading the map application, run a local server:

```
cd www && python -m http.server 8000
```

Then open your browser and navigate to `http://localhost:8000`

## School Map Navigation Application

A new interactive map navigation application is now available. To use it:

1. Navigate to `http://localhost:8000/school-map.html`
2. The application will load the SchoolMap.png image and overlay data from data.csv
3. Features:
   - Visualizes all paths from data.csv on the map
   - Detects your current location and shows "You are here" marker
   - Press Ctrl+Shift+L to enter location selection mode and click anywhere on map
   - Search for locations using the search bar
   - Click on any location in the places list to select it and show a path
   - Press D to toggle debug information

The application uses the exact same coordinate transformation from interpolation.py to convert between GPS coordinates and image coordinates.
