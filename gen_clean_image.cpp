#include <cassert>
#include <leptonica/allheaders.h>
#include <opencv2/core/types.hpp>
#include <opencv2/imgproc.hpp>
#include <opencv2/opencv.hpp>
#include <stdio.h>
#include <tesseract/baseapi.h>
#include <tesseract/publictypes.h>

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
  threshold(gray, gray, 254, 255, 0);
  cvtColor(gray, image, COLOR_GRAY2RGB);

  dnn::TextDetectionModel_EAST model("EAST.pb");

  float confThreshold = 0.01;
  float nmsThreshold = 0.5;
  model.setConfidenceThreshold(confThreshold).setNMSThreshold(nmsThreshold);

  double detScale = 1.0;
  Size detInputSize = Size(1024, 1024);
  Scalar detMean = Scalar(123.68, 116.78, 103.94);
  bool swapRB = false;
  model.setInputParams(detScale, detInputSize, detMean, swapRB);

  std::vector<std::vector<Point>> detResults;
  model.detect(image, detResults);

  // Visualization
  // polylines(image, detResults, true, Scalar(255, 255, 255), 15);
  for (auto Points : detResults) {
    std::cout << contourArea(Points) << std::endl;
    if (contourArea(Points) < 10000.) {
      fillPoly(image, Points, Scalar(255, 255, 255), LINE_8, 0, Point(0, 0));
    }
  }
  imwrite("output.png", image);
  polylines(image, detResults, true, Scalar(0, 255, 0), 2);
  imshow("Text Detection", image);
  waitKey();

  // tesseract::TessBaseAPI *api = new tesseract::TessBaseAPI();

  // api->Init(NULL, "eng", tesseract::OEM_TESSERACT_LSTM_COMBINED);
  // api->SetPageSegMode(tesseract::PSM_SPARSE_TEXT);
  // api->SetImage(gray.data, gray.cols, gray.rows, 1, gray.step);
  // api->Recognize(0);
  // tesseract::ResultIterator *ri = api->GetIterator();
  // tesseract::PageIteratorLevel level = tesseract::RIL_WORD;
  // if (ri != 0) {
  //   do {
  //     const char *word = ri->GetUTF8Text(level);
  //     float conf = ri->Confidence(level);
  //     int font_size;
  //     int temp2;
  //     bool* temp = reinterpret_cast<bool*> (&temp2);
  //     ri->WordFontAttributes(temp, temp, temp, temp, temp, temp, &font_size,
  //     &temp2); if (conf > 30.0 && strcmp(word, "|") != 0  && font_size < 36)
  //     {
  //       int x1, y1, x2, y2;
  //       ri->BoundingBox(level, &x1, &y1, &x2, &y2);
  //       rectangle(gray, Point(x1, y1), Point(x2, y2), Scalar(255, 255, 255),
  //                 -1);
  //       printf(
  //           "Removing: word: '%s';  \tconf: %.2f; BoundingBox: %d,%d,%d,%d;
  //           Font size: %d\n", word, conf, x1, y1, x2, y2, font_size);
  //     }
  //     delete[] word;
  //   } while (ri->Next(level));
  // }

  // api->SetImage(gray.data, gray.cols, gray.rows, 1, gray.step);
  // api->Recognize(0);
  // api->SetPageSegMode(tesseract::PSM_AUTO);
  // ri = api->GetIterator();
  // level = tesseract::RIL_WORD;
  // if (ri != 0) {
  //   do {
  //     const char *word = ri->GetUTF8Text(level);
  //     float conf = ri->Confidence(level);
  //     int font_size;
  //     int temp2;
  //     bool* temp = reinterpret_cast<bool*> (&temp2);
  //     ri->WordFontAttributes(temp, temp, temp, temp, temp, temp, &font_size,
  //     &temp2); if (conf > 30.0 && strcmp(word, "|") != 0 && font_size < 36) {
  //       int x1, y1, x2, y2;
  //       ri->BoundingBox(level, &x1, &y1, &x2, &y2);
  //       rectangle(gray, Point(x1, y1), Point(x2, y2), Scalar(255, 255, 255),
  //                 -1);
  //       printf(
  //           "Removing: word: '%s';  \tconf: %.2f; BoundingBox: %d,%d,%d,%d;
  //           Font size: %d\n", word, conf, x1, y1, x2, y2, font_size);
  //     }
  //     delete[] word;
  //   } while (ri->Next(level));
  // }
  // // Destroy used object and release memory
  // api->End();
  // delete api;
  // imshow(" Image", gray);

  // Mat thresh = Mat::zeros(image.size(), CV_8UC1);
  // threshold(image, thresh, 0, 255, THRESH_BINARY_INV + THRESH_OTSU);

  // Mat close_kernel = getStructuringElement(MORPH_RECT, Size(15, 3));
  // morphologyEx(thresh, thresh, MORPH_CLOSE, close_kernel, Point(-1, -1), 1);

  // Mat dilate_kernel = getStructuringElement(MORPH_RECT, Size(5, 3));
  // dilate(thresh, thresh, dilate_kernel, Point(-1, -1), 1);

  // std::vector<std::vector<Point>> cnts;
  // std::vector<Vec4i> heir;
  // findContours(thresh, cnts, heir, RETR_EXTERNAL, CHAIN_APPROX_SIMPLE);
  // cnts.erase(cnts.begin());
  // for (auto c : cnts) {
  //   double area = contourArea(c);
  //   if (area > 80 && area < 400) {
  //     auto rect = boundingRect(c);
  //     rectangle(image, rect, Scalar(255, 255, 255), -1);
  //   }
  // }
}