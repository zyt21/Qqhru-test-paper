/*------------------------------------------------------        
【程序改错】
--------------------------------------------------------

题目：下面程序的功能是将若干学生的档案存放在一个文件中，
      并显示其内容。请改正程序中的错误，使程序能得到正
      确的运行结果。

--------------------------------------------------------
注意：不可以增加或删除程序行，也不可以更改程序的结构。
------------------------------------------------------*/

#include <stdio.h>

struct student
 {
  int num;
  char name[10];
  int age;
/**********FOUND**********/
 };
struct student stu[3]={{001,"Li Mei",18},{002,"Ji Hua",19},{003,"Sun Hao",18}};

main()
{struct student *p;
/**********FOUND**********/
 FILE *fp;
 int i;
 if((fp=fopen("stu_list","w"))==NULL)
  {
  printf("cannot open file\n");
  return;
  }
 for(p=stu;p<stu+3;p++)
   fwrite(p,sizeof(struct student),1,fp);
/**********FOUND**********/
 fclose(fp);
 fp=fopen("stu_list","rb");
 printf(" No.  Name       age\n");
 for(i=1;i<=3;i++)
 {
/**********FOUND**********/ 
  fread(p,sizeof(struct student),1,fp);
  printf("%4d %-10s %4d\n",(*p).num,p->name,(*p).age);
 }
  fclose(fp);
}
