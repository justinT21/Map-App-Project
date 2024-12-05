
Install CGAL `sudo apt-get install libcgal-dev` and `sudo apt-get install libcgal-qt5-dev`

To get cgal examples run `wget https://github.com/CGAL/cgal/releases/download/v5.5.4/CGAL-5.5.4-examples.tar.xz` and untar it

Install OpenCV, follow instructions here: https://docs.opencv.org/4.x/d7/d9f/tutorial_linux_install.html

To Build run `cmake -DCMAKE_BUILD_TYPE=Release .` and `make`
All executables get put into ./bin
