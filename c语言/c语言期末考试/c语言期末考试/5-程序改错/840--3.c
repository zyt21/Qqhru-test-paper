/*------------------------------------------------------    
【程序改错】
--------------------------------------------------------

题目：有两个磁盘文件A和B,各存放一行字符，要求把这两个文件
中的信息合并，输出到一个新文件C中。
      
--------------------------------------------------------
注意：不可以增加或删除程序行，也不可以更改程序的结构。
------------------------------------------------------*/
#include "stdio.h"
#include "stdlib.h"

main()
/**********FOUND**********/
{ FILE *fp;
  int i,n,ni;
  char c[160],t,ch;
/**********FOUND**********/
  if((fp=fopen("A","r"))==NULL)
  { printf("file A cannot be opened\n");
    exit(0);
   }
  printf("\n A contents are :\n");
  for(i=0;(ch=fgetc(fp))!=EOF;i++)
    { c[i]=ch;
      putchar(c[i]);
    }
  fclose(fp);
  ni=i;
  if((fp=fopen("B","r"))==NULL)
    {printf("file B cannot be opened\n");
     exit(0);}
  printf("\n B contents are :\n");
/**********FOUND**********/
  for(i=ni;(ch=fgetc(fp))!=EOF;i++)
   {c[i]=ch;
    putchar(c[i]);
   }
  fclose(fp);
  n=i;
  printf("\n C file is:\n");
/**********FOUND**********/
  fp=fopen("C","w");
  for(i=0;i<n;i++)
   { putc(c[i],fp);
     putchar(c[i]);
   }
  fclose(fp);
}
