/*------------------------------------------------------    
【程序改错】
--------------------------------------------------------

题目：下面给定程序的功能是：从键盘输入学生的学号，姓名
      和三门课成绩，并计算出平均成绩，同时将原有的数据
      和计算出的平均分数存放在磁盘文件"stud"中。
      请改正程序中的错误，使程序能得到正确的运行结果。

--------------------------------------------------------
注意：不可以增加或删除程序行，也不可以更改程序的结构。
------------------------------------------------------*/

#include "stdio.h"

struct student
{ char num[6];
char name[8];
int score[3];
float avr;
/**********FOUND**********/
} stu[5];
main()
{int i,j,sum;
/**********FOUND**********/
FILE *fp;
for(i=0;i<5;i++)
{   printf("\n please input No. %d score:\n",i);
    printf("stuNo:");
    scanf("%s",stu[i].num);
    printf("name:");
    scanf("%s",stu[i].name);
    sum=0;
    for(j=0;j<3;j++)
        {   printf("score %d.",j+1);
        scanf("%d",&stu[i].score[j]);
        sum+=stu[i].score[j];
        }
stu[i].avr=sum/3.0;
}
/**********FOUND**********/
fp=fopen("stud","w");
for(i=0;i<5;i++)
/**********FOUND**********/
if(fwrite(&stu[i],sizeof(struct student),1,fp)!=1)
printf("file write error\n");
fclose(fp);
}
