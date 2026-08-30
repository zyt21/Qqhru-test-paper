/*-------------------------------------------------------
【程序填空】
---------------------------------------------------------

题目：下面程序的功能是输入1～7中的任意一个数字，输出对应的
星期几的英文单词。例如，如果输入2，则输出 “Tuesday”；如果
输入的数据超出1～7的范围，则输出 “输入数据超出范围!”。

-------------------------------------------------------*/

#include "stdio.h"

main()
{
/***********SPACE***********/
  int  week;
  printf("请输入1～7中的任意一个数字:");
/***********SPACE***********/
  scanf("%d",&week);
/***********SPACE***********/
  switch(week)
  {
   case 1: printf("Monday");  break;
   case 2: printf("Tuesday"); break;
   case 3: printf("Wednesday"); break;
   case 4: printf("Thursday");break;           
   case 5: printf("Friday");  break;
   case 6: printf("Saturday");break;
   case 7: printf("Sunday");  break;
/***********SPACE***********/
   default:printf("输入数据超出范围!");
  }
    printf("\n");
}
