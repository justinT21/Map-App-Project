
Install CGAL `sudo apt-get install libcgal-dev` and `sudo apt-get install libcgal-qt5-dev`

To get cgal examples run `wget https://github.com/CGAL/cgal/releases/download/v5.5.4/CGAL-5.5.4-examples.tar.xz` and untar it

Install OpenCV, follow instructions here: https://docs.opencv.org/4.x/d7/d9f/tutorial_linux_install.html

run `wget https://www.dropbox.com/s/r2ingd0l3zt8hxs/frozen_east_text_detection.tar.gz?dl=1` and untar the result and rename it to `EAST.pb`

Tesseract is needed, however it is not used: run `sudo apt install tesseract-ocr` and `sudo apt install libtesseract-dev`, if using the legacy model, you need to run `sudo wget https://github.com/tesseract-ocr/tessdata/raw/main/eng.traineddata` in the location of the trained data

To Build run `cmake -DCMAKE_BUILD_TYPE=Release .` and `make`
All executables get put into ./bin
