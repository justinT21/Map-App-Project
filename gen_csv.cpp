#include <CGAL/Distance_2/Segment_2_Ray_2.h>
#include <CGAL/Exact_predicates_inexact_constructions_kernel.h>
#include <CGAL/Polygon_with_holes_2.h>
#include <CGAL/create_straight_skeleton_from_polygon_with_holes_2.h>
#include <CGAL/draw_polygon_2.h>
#include <CGAL/draw_polygon_with_holes_2.h>
#include <CGAL/draw_straight_skeleton_2.h>
#include <CGAL/squared_distance_2.h>
#include <boost/shared_ptr.hpp>
#include <cassert>
#include <cmath>
#include <cstddef>
#include <fstream>
#include <leptonica/allheaders.h>
#include <opencv2/core/types.hpp>
#include <opencv2/imgproc.hpp>
#include <opencv2/opencv.hpp>
#include <stdio.h>
#include <tesseract/baseapi.h>
#include <tesseract/publictypes.h>
// clang-format off
#include "print.h"
// clang-format on
typedef CGAL::Exact_predicates_inexact_constructions_kernel K;
typedef K::Point_2 PointCGAL;
typedef CGAL::Polygon_2<K> Polygon_2;
typedef CGAL::Straight_skeleton_2<K> Ss;
typedef boost::shared_ptr<Ss> SsPtr;
typedef CGAL::Polygon_with_holes_2<K> Polygon_with_holes;

using namespace cv;

int main(int argc, char **argv) {
  if (argc != 2) {
    printf("usage: DisplayImage.out <Image_Path>\n");
    return -1;
  }

  Mat image;
  image = imread(argv[1], IMREAD_COLOR);

  if (!image.data) {
    printf("No image data :(\n");
    return -1;
  }

  Mat gray = Mat::zeros(image.size(), CV_8UC1);
  cvtColor(image, gray, COLOR_BGR2GRAY);

  std::vector<std::vector<Point>> contours;
  std::vector<Vec4i> hierarchy;
  threshold(gray, gray, 254, 255, 0);
  findContours(gray, contours, hierarchy, RETR_TREE, CHAIN_APPROX_SIMPLE);
  // contours.erase(contours.begin());
  Mat drawing = Mat::zeros(gray.size(), CV_8UC3);
  for (size_t i = 0; i < contours.size(); i++) {
    approxPolyDP(contours[i], contours[i], 0.005 * arcLength(contours[i], true),
                 true);
    Scalar color = Scalar(255, 100, 100);
    drawContours(drawing, contours, (int)i, color, 1, LINE_8, hierarchy, 0);
  }
  // for (const auto &v : contours) {
  //   for (auto i : v) {
  //     std::cout << i << std::endl;
  //   }
  // }
  namedWindow("Display Image", WINDOW_AUTOSIZE);
  imshow("Display Image", drawing);
  waitKey(0);

  std::vector<Polygon_2> holes;
  for (size_t i = 1; i < contours.size(); i++) {
    Polygon_2 poly;
    for (size_t j = 0; j < contours[i].size(); j++) {
      poly.push_back(PointCGAL(contours[i][j].x, -contours[i][j].y));
    }
    if (!poly.is_clockwise_oriented())
      poly.reverse_orientation();
    if (!poly.is_clockwise_oriented())
      continue;
    if (!poly.is_simple()) {
      continue;
    }
    holes.push_back(poly);
  }

  Polygon_2 polyLarge;
  for (size_t j = 0; j < contours[0].size(); j++) {
    polyLarge.push_back(PointCGAL(contours[0][j].x, -contours[0][j].y));
  }
  assert(polyLarge.is_simple());
  if (!polyLarge.is_counterclockwise_oriented())
    polyLarge.reverse_orientation();
  assert(polyLarge.is_counterclockwise_oriented());
  for (size_t j = 0; j < holes.size(); j++) {
    assert(holes[j].is_clockwise_oriented());
  }

  Polygon_with_holes poly(polyLarge);
  std::cout << holes.size() << std::endl;
  for (size_t i = 0; i < holes.size(); i++) {
    poly.add_hole(holes[i]);
  }
  // poly.add_hole(holes[2]);
  // poly.add_hole(holes[5]);
  // poly.add_hole(holes[0]);

  // You can pass the polygon via an iterator pair
  SsPtr iss = CGAL::create_interior_straight_skeleton_2(poly);
  // print_straight_skeleton(*iss);
  CGAL::draw(poly);
  CGAL::draw(*iss);
  auto ss = *iss;
  int counter = 0;
  std::ofstream data_file("data.csv");
  data_file << "x1, y1, x2, y2, weight\n";
  for (Ss::Halfedge_const_iterator i = ss.halfedges_begin();
       i != ss.halfedges_end(); ++i) {
    if (i->is_inner_bisector()) {
      if (counter++ % 2 == 0)
        continue;
      print_point(i->opposite()->vertex()->point());
      std::cout << "->";
      print_point(i->vertex()->point());

      data_file << i->opposite()->vertex()->point().x() << ","
                << i->opposite()->vertex()->point().y() << ","
                << i->vertex()->point().x() << "," << i->vertex()->point().y()
                << ","
                << sqrt(CGAL::squared_distance(i->opposite()->vertex()->point(),
                                               i->vertex()->point())) << "\n";
    }
  }
  std::cout << "\nTotal inner bisector edges: " << counter << std::endl;
  data_file.close();
  return 0;
}