# Created by the script cgal_create_cmake_script
# This is the CMake script for compiling a CGAL application.

cmake_minimum_required(VERSION 3.1...3.23)
project( Path_Gen )

set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)

find_package(CGAL REQUIRED COMPONENTS Qt5 Core)

# create a target per cppfile
create_single_source_cgal_program( "path_gen.cpp" )
target_link_libraries(path_gen PUBLIC CGAL::CGAL_Basic_viewer)
